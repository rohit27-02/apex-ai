"""Shared types passed through the orchestrator — kept here to avoid import cycles.

HandlerContext carries everything a node handler needs; HandlerResult is what
every handler returns. The engine reads the result's `outcome` to pick the next
edge in the workflow graph.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path

from backend.contracts.models import RunState, Workflow
from backend.runners.base import Runner

# Handler outcomes — these are the edge labels the graph traverses on.
SUCCESS = "success"
FAILURE = "failure"
AWAITING = "awaiting"      # human gate pause (only when not auto-approving)


@dataclass
class HandlerResult:
    """Returned by every node handler. `outcome` drives edge traversal."""

    outcome: str                       # SUCCESS | FAILURE | AWAITING
    summary: str = ""                  # human-readable, shown on the node badge
    payload: dict = field(default_factory=dict)


@dataclass
class HandlerContext:
    """Everything a handler needs to do its job and leave receipts."""

    workflow: Workflow
    run: RunState
    runner: Runner
    repo_path: str
    prompts_dir: Path
    auto_approve: bool = True          # POC: human gate auto-approves
    green_command: str | None = None   # baseline check re-run after rollback
    base_ref: str | None = None        # git ref captured before any changes

    # Carried between attempts — the feedback loop's memory.
    last_plan: dict | None = None
    last_failure: dict | None = None   # {criterion_id, command, evidence}
