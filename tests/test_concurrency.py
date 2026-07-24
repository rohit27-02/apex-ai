"""Regression tests for the live-polling robustness fixes.

1. Output sanitization — control chars stripped from receipts.
2. Concurrent serialization — dump_json() while the background thread appends
   events must always yield valid JSON (no torn read / garbage bytes).
"""

from __future__ import annotations

import json
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.contracts.models import RunState, RunStatus
from backend.orchestrator.state import sanitize_output


class TestSanitize:
    def test_strips_ansi_and_nul_keeps_newlines(self) -> None:
        raw = "line1\n\x1b[31mred\x1b[0m\ttab\x00nul\x0cff\rok"
        clean = sanitize_output(raw)
        assert "\x1b" not in clean and "\x00" not in clean and "\x0c" not in clean
        assert "\n" in clean and "\t" in clean and "\r" in clean
        assert "red" in clean and "tab" in clean

    def test_empty(self) -> None:
        assert sanitize_output("") == ""

    def test_sanitized_evidence_is_valid_json(self) -> None:
        run = _fresh_run()
        run.emit("v", "criterion_failed", {"evidence": sanitize_output("bad\x1b[0m\x00out")})
        json.loads(run.dump_json())  # raises if invalid


class TestConcurrentSerialization:
    def test_dump_json_during_appends_is_always_valid(self) -> None:
        """A writer appends a bounded number of events while readers serialize
        concurrently. Without the shared lock this intermittently yields garbage
        bytes ('invalid control character'); with it, every dump is valid JSON."""
        run = _fresh_run()
        errors: list[str] = []
        TOTAL = 500  # bounded so the events list can't grow without limit

        def writer() -> None:
            for i in range(TOTAL):
                run.emit("exec", "files_changed", {"files": [f"f{i}.py"], "note": "x" * 100})

        def reader() -> None:
            for _ in range(TOTAL):
                try:
                    json.loads(run.dump_json())
                except Exception as exc:  # noqa: BLE001 - the whole point is to catch any
                    errors.append(repr(exc))
                    return

        threads = [threading.Thread(target=writer)] + [
            threading.Thread(target=reader) for _ in range(3)
        ]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert not errors, f"invalid JSON under concurrency: {errors[:3]}"
        assert len(run.events) == TOTAL


def _fresh_run() -> RunState:
    now = datetime.now(timezone.utc)
    return RunState(
        run_id="conc-1", status=RunStatus.running, attempt=1, max_attempts=3,
        objective="x", started_at=now, updated_at=now,
    )
