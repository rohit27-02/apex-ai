import json
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException

from backend.contracts.models import RunCreateRequest, RunState, RunStatus

app = FastAPI(title="AI Coding Loop - Orchestrator API")

FIXTURE_PATH = Path(__file__).resolve().parent.parent / "fixtures" / "sample_run.json"
_FIXTURE_RUN = json.loads(FIXTURE_PATH.read_text())

_runs: dict[str, RunState] = {}


@app.post("/runs", response_model=RunState)
def create_run(request: RunCreateRequest) -> RunState:
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    fixture = dict(_FIXTURE_RUN)
    fixture["run_id"] = run_id
    fixture["objective"] = request.objective
    fixture["max_attempts"] = request.maxAttempts
    fixture["started_at"] = now.isoformat()
    fixture["updated_at"] = now.isoformat()

    run_state = RunState.model_validate(fixture)
    _runs[run_id] = run_state
    return run_state


@app.get("/runs/{run_id}", response_model=RunState)
def get_run(run_id: str) -> RunState:
    run_state = _runs.get(run_id)
    if run_state is None:
        raise HTTPException(status_code=404, detail=f"run {run_id} not found")
    return run_state


@app.post("/runs/{run_id}/stop", response_model=RunState)
def stop_run(run_id: str) -> RunState:
    run_state = _runs.get(run_id)
    if run_state is None:
        raise HTTPException(status_code=404, detail=f"run {run_id} not found")

    updated = run_state.model_copy(
        update={
            "status": RunStatus.stopped_safely,
            "updated_at": datetime.now(timezone.utc),
        }
    )
    _runs[run_id] = updated
    return updated
