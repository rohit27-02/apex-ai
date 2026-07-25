"""Shared data contracts for the autonomous coding loop.

Single source of truth for the whole team. Aligned with
run_state.schema.json and sample_workflow_request.json.

Merged from Person A (API/orchestrator) and Person B (runners) contracts.
FROZEN — do not rename fields without telling the team. Legacy aliases
(RunEvent, CriterionResult) are kept so existing imports keep working.
"""

from __future__ import annotations

import threading
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field, PrivateAttr


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# Enums
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
# Workflow contract (authored in the UI, executed by the orchestrator)
# Aligned with sample_workflow_request.json (source/target/on edges).
# ---------------------------------------------------------------------------

class WorkflowNode(BaseModel):
    id: str
    type: NodeType
    name: str = ""
    config: dict = Field(default_factory=dict)


class WorkflowEdge(BaseModel):
    source: str
    target: str
    on: EdgeOutcome = EdgeOutcome.success


class Workflow(BaseModel):
    entryNode: str
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]
    name: str = "default"
    max_attempts: int = 3
    repo_path: str = ""

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(self.model_dump_json(indent=2))

    @classmethod
    def load(cls, path: Path) -> Workflow:
        return cls.model_validate_json(path.read_text())

    def get_node(self, node_id: str) -> WorkflowNode:
        for n in self.nodes:
            if n.id == node_id:
                return n
        raise KeyError(f"Node {node_id!r} not found")

    def next_node(self, current_id: str, outcome: str) -> str | None:
        """Follow edges from current_id based on outcome ('success'/'failure')."""
        for e in self.edges:
            if e.source == current_id and e.on == outcome:
                return e.target
        return None


class RunCreateRequest(BaseModel):
    workflow: Workflow
    objective: str
    maxAttempts: int
    # Optional execution settings — defaults keep older requests valid.
    runner: str = "stub"               # "stub" | "aider"
    model: str | None = None           # model override, e.g. "groq/llama-3.3-70b-versatile"
    api_key: str | None = None         # BYOK: per-run key; overrides backend .env keys
    base_url: str | None = None        # custom base URL for OpenAI-compatible endpoints
    repo_path: str = ""                # target repo; falls back to workflow.repo_path
    auto_approve: bool = True          # False = human gate really pauses
    green_command: str | None = None   # baseline suite re-run after rollback


# ---------------------------------------------------------------------------
# Runner contract (Person B owns, orchestrator calls)
# ---------------------------------------------------------------------------

class RunnerResult(BaseModel):
    """Returned by Runner.run() after each agent execution step."""

    transcript_path: str         # path to persisted JSONL transcript
    files_changed: list[str]     # relative paths from repo root
    status: str                  # "success" | "failed" | "timeout"
    model_calls: int             # count of LLM interactions in this run


# ---------------------------------------------------------------------------
# Run state contract (orchestrator owns, UI renders)
# Aligned with run_state.schema.json.
# ---------------------------------------------------------------------------

class CostCounters(BaseModel):
    model_calls: int = 0
    seconds: float = 0.0


class NodeState(BaseModel):
    status: NodeStatus = NodeStatus.pending
    started_at: datetime | None = None
    ended_at: datetime | None = None
    result_summary: str | None = None
    # Live per-node log lines — the agent's thinking + tool usage streamed from
    # the runner, or the validator's per-criterion results. Capped (see
    # append_node_log) so the run payload stays small.
    logs: list[str] = Field(default_factory=list)


class Event(BaseModel):
    timestamp: datetime
    node_id: str
    type: str
    payload: dict = Field(default_factory=dict)


class Criterion(BaseModel):
    id: str
    description: str
    command: str
    expect_exit_code: int = 0
    status: CriterionStatus = CriterionStatus.pending
    # Extended evidence fields (optional; not required by run_state.schema.json)
    exit_code: int | None = None
    evidence: str = ""
    duration_s: float = 0.0


# Legacy aliases — Person B's runners/tests refer to these names.
RunEvent = Event
CriterionResult = Criterion


class RunState(BaseModel):
    run_id: str
    status: RunStatus = RunStatus.created
    attempt: int = 0
    max_attempts: int
    objective: str
    started_at: datetime = Field(default_factory=_now)
    updated_at: datetime = Field(default_factory=_now)
    delivered: bool = False      # true only on validation pass + human-gate approval
    cost: CostCounters = Field(default_factory=CostCounters)
    node_states: dict[str, NodeState] = Field(default_factory=dict)
    events: list[Event] = Field(default_factory=list)
    criteria: list[Criterion] = Field(default_factory=list)

    # Guards the events list: the orchestrator runs in a background thread and
    # appends events while the API serializes this model. Sharing this lock
    # between emit() and dump_json() prevents a torn read of the growing list.
    _lock: Any = PrivateAttr(default_factory=threading.RLock)

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(self.dump_json(indent=2))

    @classmethod
    def load(cls, path: Path) -> RunState:
        return cls.model_validate_json(path.read_text())

    def dump_json(self, indent: int | None = None) -> str:
        """Serialize atomically w.r.t. emit() — safe to call from any thread."""
        with self._lock:
            return self.model_dump_json(indent=indent)

    def emit(self, node_id: str, event_type: str, payload: dict | None = None) -> None:
        """Append a timestamped event to the run log (a receipt)."""
        now = _now()
        with self._lock:
            self.events.append(Event(
                timestamp=now,
                node_id=node_id,
                type=event_type,
                payload=payload or {},
            ))
            self.updated_at = now

    def append_log(self, node_id: str, line: str, cap: int = 200) -> None:
        """Append a live log line to a node, capped to the most recent `cap`
        lines. Thread-safe against dump_json (guards the logs list mutation)."""
        with self._lock:
            node = self.node_states.get(node_id)
            if node is None:
                node = NodeState()
                self.node_states[node_id] = node
            node.logs.append(line)
            if len(node.logs) > cap:
                del node.logs[: len(node.logs) - cap]
            self.updated_at = _now()

    def clear_logs(self, node_id: str) -> None:
        """Reset a node's logs (called when a node re-runs on a new attempt)."""
        with self._lock:
            node = self.node_states.get(node_id)
            if node is not None:
                node.logs = []
