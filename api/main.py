"""FastAPI app — the API entry point.

POST /runs        → create a run (starts engine in background)
GET  /runs/{id}   → get run state + events (frontend polls this)
POST /runs/{id}/stop → stop a run
"""

import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from contracts.models import (
    RunCreateRequest, RunState, RunStatus, NodeStatus,
    NodeState, Event, Criterion, CriterionStatus,
)
from orchestrator.engine import Engine

app = FastAPI(title="AI Coding Loop API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory run store (production would use SQLite/JSON files)
_runs: dict[str, RunState] = {}
_engines: dict[str, Engine] = {}


@app.post("/runs", response_model=RunState)
def create_run(request: RunCreateRequest) -> RunState:
    """Create a new run and start execution in background."""
    run_id = str(uuid.uuid4())[:8]
    now = datetime.now(timezone.utc)

    # Create engine
    engine = Engine(
        workflow=request.workflow,
        objective=request.objective,
        max_attempts=request.maxAttempts,
        repo_path=request.workflow.entryNode,  # placeholder
    )
    engine.run.run_id = run_id

    # Store
    _runs[run_id] = engine.run
    _engines[run_id] = engine

    # Start execution in background thread
    thread = threading.Thread(target=_run_engine, args=(run_id, engine), daemon=True)
    thread.start()

    return engine.run


@app.get("/runs/{run_id}", response_model=RunState)
def get_run(run_id: str) -> RunState:
    """Get current run state + events. Frontend polls this every 1s."""
    run = _runs.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")
    return run


@app.post("/runs/{run_id}/stop", response_model=RunState)
def stop_run(run_id: str) -> RunState:
    """Stop a running run."""
    run = _runs.get(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail=f"Run {run_id} not found")

    updated = run.model_copy(update={
        "status": RunStatus.stopped_safely,
        "updated_at": datetime.now(timezone.utc),
    })
    _runs[run_id] = updated
    return updated


def _run_engine(run_id: str, engine: Engine) -> None:
    """Run the engine in a background thread."""
    try:
        final_state = engine.run_workflow()
        _runs[run_id] = final_state
    except Exception as e:
        run = _runs.get(run_id)
        if run:
            _runs[run_id] = run.model_copy(update={
                "status": RunStatus.failed,
                "updated_at": datetime.now(timezone.utc),
            })
