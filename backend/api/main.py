"""Orchestrator API — the single integration point for the frontend.

Endpoints (poll GET /runs/{id} every ~1s; no WebSockets):
    POST /runs               create + launch a REAL orchestrator run (background)
    GET  /runs               list run summaries
    GET  /runs/{id}          current run state (node badges, receipts, criteria)
    POST /runs/{id}/stop     safe stop (no rollback; work left in place)
    POST /runs/{id}/approve  resolve a paused human gate {"approved": true|false}
    POST /runs/fixture       canned 2-attempt run — frontend dev / demo rehearsal
    POST /workflows/export   validate a workflow config and echo it back (export)

The run executes in a background thread-pool task; GET returns the same
RunState object the engine mutates, so polling sees live node transitions.
"""

from __future__ import annotations

import json
import tempfile
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import BackgroundTasks, FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from backend.contracts.models import (
    NodeType,
    RunCreateRequest,
    RunState,
    RunStatus,
    Workflow,
)
from backend.orchestrator import Orchestrator
from backend.runners.base import Runner
from backend.runners.stub_runner import StubRunner

app = FastAPI(title="AI Coding Loop - Orchestrator API")

# Frontend dev server runs on another port — allow it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "sample_run.json"
_FIXTURE_RUN = json.loads(FIXTURE_PATH.read_text())

# All runs by id. Orchestrator-backed entries share the exact object the engine
# mutates, so polling GET /runs/{id} sees live progress.
_runs: dict[str, RunState] = {}
_orchestrators: dict[str, Orchestrator] = {}

_ACTIVE = (RunStatus.created, RunStatus.running, RunStatus.awaiting_approval)


class ApprovalRequest(BaseModel):
    approved: bool
    feedback: str = ""


def _build_runner(request: RunCreateRequest) -> Runner:
    if request.runner == "aider":
        from backend.runners.aider_runner import AiderRunner

        kwargs: dict = {}
        if request.model:
            kwargs["model"] = request.model
        if request.api_key:            # BYOK from the frontend
            kwargs["api_key"] = request.api_key
        return AiderRunner(**kwargs)
    return StubRunner()


def _get_run_or_404(run_id: str) -> RunState:
    run = _runs.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"run {run_id} not found")
    return run


def _run_response(run: RunState) -> Response:
    """Serialize a run via its lock (safe against the background thread's
    concurrent event appends) instead of FastAPI's own encoder."""
    return Response(content=run.dump_json(), media_type="application/json")


# ---------------------------------------------------------------------------
# Real runs
# ---------------------------------------------------------------------------

@app.get("/health")
def health() -> dict:
    """Liveness probe — the frontend uses this to pick real mode over demo mode."""
    return {"status": "ok", "runs": len(_runs)}


@app.post("/runs", response_model=RunState)
def create_run(request: RunCreateRequest, background_tasks: BackgroundTasks) -> Response:
    # No target repo given -> isolated scratch workspace, never the server CWD.
    repo_path = (request.repo_path or request.workflow.repo_path
                 or tempfile.mkdtemp(prefix="apex-workspace-"))
    orch = Orchestrator(
        request.workflow,
        runner=_build_runner(request),
        objective=request.objective,
        max_attempts=request.maxAttempts,
        repo_path=repo_path,
        auto_approve=request.auto_approve,
        green_command=request.green_command,
    )
    _runs[orch.run.run_id] = orch.run
    _orchestrators[orch.run.run_id] = orch
    background_tasks.add_task(orch.run_to_completion)
    return _run_response(orch.run)


@app.get("/runs")
def list_runs() -> list[dict]:
    return [
        {
            "run_id": r.run_id,
            "status": r.status,
            "attempt": r.attempt,
            "max_attempts": r.max_attempts,
            "objective": r.objective,
            "delivered": r.delivered,
            "started_at": r.started_at,
            "updated_at": r.updated_at,
        }
        for r in _runs.values()
    ]


@app.get("/runs/{run_id}", response_model=RunState)
def get_run(run_id: str) -> Response:
    return _run_response(_get_run_or_404(run_id))


@app.post("/runs/{run_id}/stop", response_model=RunState)
def stop_run(run_id: str) -> Response:
    """Safe stop: the engine halts at the next node boundary. No rollback —
    a user stop leaves the work in place for inspection."""
    run = _get_run_or_404(run_id)
    if run.status in _ACTIVE:
        run.status = RunStatus.stopped_safely
        run.delivered = False
        orch = _orchestrators.get(run_id)
        stop_node = None
        if orch is not None:
            stop_node = next(
                (n.id for n in orch.workflow.nodes if n.type == NodeType.stop), None
            )
        run.emit(stop_node or "stop", "run_stopped_safely",
                 {"reason": "user requested stop", "delivered": False})
    return _run_response(run)


@app.post("/runs/{run_id}/approve", response_model=RunState)
def approve_run(run_id: str, decision: ApprovalRequest) -> Response:
    """Resolve a human gate. Approve -> continue to Success; reject -> Stopped Safely."""
    run = _get_run_or_404(run_id)
    orch = _orchestrators.get(run_id)
    if orch is None or run.status != RunStatus.awaiting_approval:
        raise HTTPException(status_code=409,
                            detail=f"run {run_id} is not awaiting approval")
    if decision.feedback:
        run.emit(orch.paused_node or "human_gate", "human_feedback",
                 {"feedback": decision.feedback})
    orch.resume(decision.approved)
    return _run_response(run)


# ---------------------------------------------------------------------------
# Fixture run — Person C's rich render data, zero execution
# ---------------------------------------------------------------------------

@app.post("/runs/fixture", response_model=RunState)
def create_fixture_run() -> Response:
    """Canned 2-attempt run (fail then pass, awaiting approval). Keeps frontend
    development and demo rehearsals free and instant."""
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    fixture = dict(_FIXTURE_RUN)
    fixture["run_id"] = run_id
    fixture["started_at"] = now
    fixture["updated_at"] = now
    run_state = RunState.model_validate(fixture)
    _runs[run_id] = run_state
    return _run_response(run_state)


# ---------------------------------------------------------------------------
# Workflow export — the canvas is a view over this JSON
# ---------------------------------------------------------------------------

@app.post("/workflows/export", response_model=Workflow)
def export_workflow(workflow: Workflow) -> Workflow:
    """Validate a workflow config and return its normalized JSON. The export
    file is exactly this response body."""
    return workflow
