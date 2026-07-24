from __future__ import annotations

from datetime import datetime
from enum import Enum

from pydantic import BaseModel


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


class RunCreateRequest(BaseModel):
    workflow: Workflow
    objective: str
    maxAttempts: int


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


class CriterionStatus(str, Enum):
    pending = "pending"
    passed = "passed"
    failed = "failed"


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
