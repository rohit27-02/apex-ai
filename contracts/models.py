"""Shared data contracts for the autonomous coding loop.

Aligned with Person A's implementation. FROZEN after contract meeting.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from pathlib import Path

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Runner contract (Person B owns, Person A calls)
# ---------------------------------------------------------------------------

class RunnerResult(BaseModel):
    """Returned by Runner.run() after each agent execution step."""

    transcript_path: str
    files_changed: list[str]
    status: str                  # "success" | "failed" | "timeout"
    model_calls: int


# ---------------------------------------------------------------------------
# Enums (Person A's definitions)
# ---------------------------------------------------------------------------

class NodeType(str, Enum):
    input = "input"
    agent = "agent"
    command = "command"
    validator = "validator"
    decision = "decision"
    human_gate = "human_gate"
    success = "success"
    stop = "stop"


class EdgeOutcome(str, Enum):
    success = "success"
    failure = "failure"


class RunStatus(str, Enum):
    created = "created"
    running = "running"
    awaiting_approval = "awaiting_approval"
    success = "success"
    failed = "failed"
    stopped_safely = "stopped_safely"
    rolled_back = "rolled_back"


class NodeStatus(str, Enum):
    pending = "pending"
    running = "running"
    success = "success"
    failed = "failed"
    skipped = "skipped"


class CriterionStatus(str, Enum):
    pending = "pending"
    passed = "passed"
    failed = "failed"


# ---------------------------------------------------------------------------
# Workflow contract (Person B creates, Person A executes, Person C edits)
# ---------------------------------------------------------------------------

class WorkflowNode(BaseModel):
    id: str
    type: NodeType
    config: dict = {}


class WorkflowEdge(BaseModel):
    source: str
    target: str
    on: EdgeOutcome


class Workflow(BaseModel):
    entryNode: str
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]

    def get_node(self, node_id: str) -> WorkflowNode:
        for n in self.nodes:
            if n.id == node_id:
                return n
        raise KeyError(f"Node {node_id!r} not found")

    def next_node(self, current_id: str, outcome: EdgeOutcome) -> str | None:
        """Follow edges from current_id based on outcome."""
        for e in self.edges:
            if e.source == current_id and e.on == outcome:
                return e.target
        return None

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(self.model_dump_json(indent=2))

    @classmethod
    def load(cls, path: Path) -> Workflow:
        return cls.model_validate_json(path.read_text())


# ---------------------------------------------------------------------------
# Run state contract (Person A owns, Person C renders, Person B contributes)
# ---------------------------------------------------------------------------

class RunCreateRequest(BaseModel):
    workflow: Workflow
    objective: str
    maxAttempts: int


class NodeState(BaseModel):
    status: NodeStatus
    started_at: datetime | None = None
    ended_at: datetime | None = None
    result_summary: str | None = None


class Event(BaseModel):
    timestamp: datetime
    node_id: str
    type: str
    payload: dict = {}


class Criterion(BaseModel):
    id: str
    description: str
    command: str
    expect_exit_code: int
    status: CriterionStatus


class RunState(BaseModel):
    run_id: str
    status: RunStatus
    attempt: int
    max_attempts: int
    objective: str
    started_at: datetime
    updated_at: datetime
    delivered: bool
    node_states: dict[str, NodeState]
    events: list[Event]
    criteria: list[Criterion]

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(self.model_dump_json(indent=2))

    @classmethod
    def load(cls, path: Path) -> RunState:
        return cls.model_validate_json(path.read_text())
