"""StubRunner — applies a canned patch and returns a fake transcript.

Used for:
- Frontend development before the real runner is ready
- Demo rehearsals (instant, no API calls)
- Integration testing with Person A and Person D

To swap: change RUNNER_TYPE from "stub" to "aider" in orchestrator config.
"""

from __future__ import annotations

import json
import time
from pathlib import Path

from backend.contracts.models import RunnerResult
from backend.runners.base import LogSink

# Fake "thinking" + tool-use lines so streaming is demonstrable without a key.
_STUB_LOG_LINES = [
    "Thinking: reading the repository to understand the objective…",
    "Tool: Read(app/main.py)",
    "Thinking: the change is localized; I'll apply a small patch.",
    "Tool: Edit(app/main.py)",
    "Applied canned patch to app/main.py",
]


class StubRunner:
    """Applies a canned patch and returns a fake transcript. Zero API calls."""

    def __init__(self, fake_model_calls: int = 3) -> None:
        self._fake_model_calls = fake_model_calls

    def run(
        self,
        prompt: str,
        cwd: str,
        tools: list[str] | None = None,
        on_log: LogSink | None = None,
    ) -> RunnerResult:
        run_dir = Path(cwd) / ".run_output"
        run_dir.mkdir(parents=True, exist_ok=True)

        if on_log:
            for line in _STUB_LOG_LINES:
                on_log(line)

        transcript_path = run_dir / "transcript.jsonl"
        self._write_transcript(transcript_path, prompt)

        # Actually apply the canned patch we claim — so deterministic criteria
        # (e.g. `test -f app/main.py`) can genuinely pass in stub demos.
        patched = Path(cwd) / "app" / "main.py"
        patched.parent.mkdir(parents=True, exist_ok=True)
        patched.write_text("# patched code (StubRunner canned patch)\n")
        files_changed = ["app/main.py"]

        return RunnerResult(
            transcript_path=str(transcript_path),
            files_changed=files_changed,
            status="success",
            model_calls=self._fake_model_calls,
        )

    def _write_transcript(self, path: Path, prompt: str) -> None:
        ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        events = [
            {"ts": ts, "type": "assistant", "content": f"[STUB] Received prompt: {prompt[:200]}"},
            {"ts": ts, "type": "tool_use", "tool": "Read", "input": {"file_path": "app/main.py"}},
            {"ts": ts, "type": "tool_result", "tool": "Read", "output": "...file content..."},
            {"ts": ts, "type": "tool_use", "tool": "Edit", "input": {
                "file_path": "app/main.py",
                "old_string": "# existing code",
                "new_string": "# patched code",
            }},
            {"ts": ts, "type": "tool_result", "tool": "Edit", "output": "Success"},
            {"ts": ts, "type": "assistant", "content": "[STUB] Applied canned patch to app/main.py"},
        ]
        with open(path, "w") as f:
            for event in events:
                f.write(json.dumps(event) + "\n")
