"""API-level tests — the full stack through HTTP, as the frontend consumes it.

TestClient executes background tasks before the call returns, so a POST /runs
completes the whole orchestrated run deterministically; in production the
response returns immediately and the frontend polls GET /runs/{id}.

Covered:
  - real run passes -> success, delivered, receipts visible over HTTP
  - real run exhausts budget -> rollback receipts, honest undelivered report
  - the committed sample_workflow_request works and reports honestly
  - human gate: pause -> approve -> delivered; pause -> reject -> stopped safely
  - stop, 404, fixture run, workflow export round-trip
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.api.main import app  # noqa: E402

client = TestClient(app)

FIXTURES = Path(__file__).resolve().parent.parent / "backend" / "fixtures"


def make_request(
    criteria: list[dict],
    repo_path: str,
    max_attempts: int = 3,
    auto_approve: bool = True,
    green_command: str | None = None,
) -> dict:
    """A default 4-agent loop request with configurable criteria."""
    return {
        "workflow": {
            "entryNode": "criteria",
            "nodes": [
                {"id": "criteria", "type": "agent",
                 "config": {"role": "criteria", "criteria": criteria}},
                {"id": "planning", "type": "agent", "config": {"role": "planning"}},
                {"id": "execution", "type": "agent", "config": {"role": "execution"}},
                {"id": "validation", "type": "validator"},
                {"id": "human_gate", "type": "human_gate"},
                {"id": "success", "type": "success"},
                {"id": "stop", "type": "stop"},
            ],
            "edges": [
                {"source": "criteria", "target": "planning", "on": "success"},
                {"source": "planning", "target": "execution", "on": "success"},
                {"source": "execution", "target": "validation", "on": "success"},
                {"source": "validation", "target": "human_gate", "on": "success"},
                {"source": "validation", "target": "planning", "on": "failure"},
                {"source": "human_gate", "target": "success", "on": "success"},
            ],
        },
        "objective": "test objective",
        "maxAttempts": max_attempts,
        "repo_path": repo_path,
        "auto_approve": auto_approve,
        "green_command": green_command,
    }


def _event_types(state: dict) -> list[str]:
    return [e["type"] for e in state["events"]]


# ---------------------------------------------------------------------------
# Real runs through the API
# ---------------------------------------------------------------------------

class TestRealRuns:
    def test_passing_run_delivers(self, tmp_path: Path) -> None:
        req = make_request(
            [{"id": "c1", "description": "always green", "command": "python -c \"import sys; sys.exit(0)\""}],
            repo_path=str(tmp_path),
        )
        r = client.post("/runs", json=req)
        assert r.status_code == 200, r.text
        run_id = r.json()["run_id"]

        state = client.get(f"/runs/{run_id}").json()
        assert state["status"] == "success"
        assert state["delivered"] is True
        assert state["attempt"] == 1
        types = _event_types(state)
        assert "criterion_passed" in types
        assert "human_gate_approved" in types
        assert "run_succeeded" in types

    def test_failing_run_retreats_honestly(self, tmp_path: Path) -> None:
        req = make_request(
            [{"id": "c1", "description": "always red", "command": "python -c \"import sys; sys.exit(1)\""}],
            repo_path=str(tmp_path),
            max_attempts=2,
        )
        run_id = client.post("/runs", json=req).json()["run_id"]

        state = client.get(f"/runs/{run_id}").json()
        assert state["status"] in ("stopped_safely", "rolled_back")
        assert state["delivered"] is False
        assert state["attempt"] == 2, "budget of 2 must be spent exactly"
        types = _event_types(state)
        assert "criterion_failed" in types
        assert "retry_triggered" in types
        assert "rollback_started" in types
        assert "rollback_completed" in types
        assert "run_stopped_safely" in types

    def test_committed_sample_request_reports_honestly(self, tmp_path: Path) -> None:
        """The repo's own sample request (no criteria configured) must not
        falsely deliver — zero criteria means acceptance can never pass."""
        req = json.loads((FIXTURES / "sample_workflow_request.json").read_text())
        req["repo_path"] = str(tmp_path)
        r = client.post("/runs", json=req)
        assert r.status_code == 200, r.text
        state = client.get(f"/runs/{r.json()['run_id']}").json()
        assert state["delivered"] is False
        assert state["status"] in ("stopped_safely", "rolled_back")

    def test_cost_counters_present(self, tmp_path: Path) -> None:
        req = make_request(
            [{"id": "c1", "description": "green", "command": "python -c \"import sys; sys.exit(0)\""}],
            repo_path=str(tmp_path),
        )
        run_id = client.post("/runs", json=req).json()["run_id"]
        state = client.get(f"/runs/{run_id}").json()
        assert state["cost"]["model_calls"] >= 2  # planning + execution at least
        assert state["cost"]["seconds"] >= 0.0


# ---------------------------------------------------------------------------
# Human gate over HTTP
# ---------------------------------------------------------------------------

class TestHumanGate:
    def _paused_run(self, tmp_path: Path) -> str:
        req = make_request(
            [{"id": "c1", "description": "green", "command": "python -c \"import sys; sys.exit(0)\""}],
            repo_path=str(tmp_path),
            auto_approve=False,
        )
        run_id = client.post("/runs", json=req).json()["run_id"]
        state = client.get(f"/runs/{run_id}").json()
        assert state["status"] == "awaiting_approval"
        assert state["delivered"] is False
        return run_id

    def test_approval_delivers(self, tmp_path: Path) -> None:
        run_id = self._paused_run(tmp_path)
        r = client.post(f"/runs/{run_id}/approve", json={"approved": True})
        assert r.status_code == 200
        state = r.json()
        assert state["status"] == "success"
        assert state["delivered"] is True

    def test_rejection_stops_safely(self, tmp_path: Path) -> None:
        run_id = self._paused_run(tmp_path)
        state = client.post(f"/runs/{run_id}/approve",
                            json={"approved": False, "feedback": "not good enough"}).json()
        assert state["status"] == "stopped_safely"
        assert state["delivered"] is False
        assert "human_gate_rejected" in _event_types(state)
        assert "human_feedback" in _event_types(state)

    def test_approve_when_not_paused_is_409(self, tmp_path: Path) -> None:
        req = make_request(
            [{"id": "c1", "description": "green", "command": "python -c \"import sys; sys.exit(0)\""}],
            repo_path=str(tmp_path),
        )
        run_id = client.post("/runs", json=req).json()["run_id"]  # auto-approved
        r = client.post(f"/runs/{run_id}/approve", json={"approved": True})
        assert r.status_code == 409


# ---------------------------------------------------------------------------
# Controls, fixture, export
# ---------------------------------------------------------------------------

class TestControls:
    def test_get_unknown_run_404(self) -> None:
        assert client.get("/runs/does-not-exist").status_code == 404

    def test_stop_unknown_run_404(self) -> None:
        assert client.post("/runs/does-not-exist/stop").status_code == 404

    def test_fixture_run_serves_rich_state(self) -> None:
        state = client.post("/runs/fixture").json()
        assert state["status"] == "awaiting_approval"
        assert state["attempt"] == 2
        assert len(state["criteria"]) == 3
        assert len(state["events"]) > 10
        # and it is fetchable + stoppable like any run
        run_id = state["run_id"]
        assert client.get(f"/runs/{run_id}").status_code == 200
        stopped = client.post(f"/runs/{run_id}/stop").json()
        assert stopped["status"] == "stopped_safely"
        assert stopped["delivered"] is False

    def test_stop_completed_run_is_noop(self, tmp_path: Path) -> None:
        req = make_request(
            [{"id": "c1", "description": "green", "command": "python -c \"import sys; sys.exit(0)\""}],
            repo_path=str(tmp_path),
        )
        run_id = client.post("/runs", json=req).json()["run_id"]
        state = client.post(f"/runs/{run_id}/stop").json()
        assert state["status"] == "success"     # terminal state untouched
        assert state["delivered"] is True

    def test_list_runs_includes_created(self, tmp_path: Path) -> None:
        req = make_request(
            [{"id": "c1", "description": "green", "command": "python -c \"import sys; sys.exit(0)\""}],
            repo_path=str(tmp_path),
        )
        run_id = client.post("/runs", json=req).json()["run_id"]
        listing = client.get("/runs").json()
        assert any(item["run_id"] == run_id for item in listing)

    def test_workflow_export_round_trip(self) -> None:
        wf = json.loads((FIXTURES / "sample_workflow_request.json").read_text())["workflow"]
        r = client.post("/workflows/export", json=wf)
        assert r.status_code == 200
        exported = r.json()
        assert exported["entryNode"] == "criteria"
        assert len(exported["nodes"]) == 7
        assert len(exported["edges"]) == 6
        # export is import-ready: posting it back validates identically
        assert client.post("/workflows/export", json=exported).status_code == 200


# ---------------------------------------------------------------------------
# Frontend integration seam — health probe + the canvas default graph shape
# ---------------------------------------------------------------------------

def make_canvas_request(criteria: list[dict], repo_path: str,
                        auto_approve: bool = False) -> dict:
    """Mirrors what frontend/src/lib/workflow-adapter.ts sends for the
    DEFAULT_WORKFLOW: input entry, decision-routed failure, hyphenated ids."""
    return {
        "workflow": {
            "entryNode": "input",
            "nodes": [
                {"id": "input", "type": "input"},
                {"id": "criteria", "type": "agent",
                 "config": {"role": "criteria", "criteria": criteria}},
                {"id": "planning", "type": "agent", "config": {"role": "planning"}},
                {"id": "execution", "type": "agent", "config": {"role": "execution"}},
                {"id": "validation", "type": "validator"},
                {"id": "decision", "type": "decision"},
                {"id": "human-gate", "type": "human_gate"},
                {"id": "success", "type": "success"},
                {"id": "stop", "type": "stop"},
            ],
            "edges": [
                {"source": "input", "target": "criteria", "on": "success"},
                {"source": "criteria", "target": "planning", "on": "success"},
                {"source": "planning", "target": "execution", "on": "success"},
                {"source": "execution", "target": "validation", "on": "success"},
                {"source": "validation", "target": "decision", "on": "success"},
                {"source": "decision", "target": "human-gate", "on": "success"},
                {"source": "decision", "target": "planning", "on": "failure"},
                {"source": "human-gate", "target": "success", "on": "success"},
            ],
        },
        "objective": "canvas-shaped run",
        "maxAttempts": 3,
        "repo_path": repo_path,
        "auto_approve": auto_approve,
    }


class TestFrontendSeam:
    def test_health(self) -> None:
        r = client.get("/health")
        assert r.status_code == 200
        assert r.json()["status"] == "ok"

    def test_canvas_graph_pauses_at_gate_then_delivers(self, tmp_path: Path) -> None:
        # StubRunner writes app/main.py, so this criterion genuinely passes.
        req = make_canvas_request(
            [{"id": "c1", "description": "patched module exists",
              "command": "python -c \"import os, sys; sys.exit(0 if os.path.exists('app/main.py') else 1)\""}],
            repo_path=str(tmp_path),
        )
        run_id = client.post("/runs", json=req).json()["run_id"]

        state = client.get(f"/runs/{run_id}").json()
        assert state["status"] == "awaiting_approval"
        assert state["node_states"]["human-gate"]["status"] == "running"

        approved = client.post(f"/runs/{run_id}/approve",
                               json={"approved": True, "feedback": "LGTM"}).json()
        assert approved["status"] == "success"
        assert approved["delivered"] is True
        # feedback receipt is attached to the actual gate node id
        fb = [e for e in approved["events"] if e["type"] == "human_feedback"]
        assert fb and fb[0]["node_id"] == "human-gate"

    def test_no_repo_path_uses_isolated_workspace(self) -> None:
        """Omitting repo_path must never run in the server CWD."""
        req = make_canvas_request(
            [{"id": "c1", "description": "patched module exists",
              "command": "python -c \"import os, sys; sys.exit(0 if os.path.exists('app/main.py') else 1)\""}],
            repo_path="", auto_approve=True,
        )
        run_id = client.post("/runs", json=req).json()["run_id"]
        state = client.get(f"/runs/{run_id}").json()
        assert state["status"] == "success"
        assert not Path("app/main.py").exists(), "server CWD must stay clean"
