"""Shared data contracts for the autonomous coding loop.

These types are the integration boundary between all team members.
FROZEN after the contract meeting — do not rename fields without telling the team.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Runner contract (Person B owns, Person A calls)
# ---------------------------------------------------------------------------

class RunnerResult(BaseModel):
    """Returned by Runner.run() after each agent execution step."""

    transcript_path: str         # path to persisted JSONL transcript
    files_changed: list[str]     # relative paths from repo root
    status: str                  # "success" | "failed" | "timeout"
    model_calls: int             # count of LLM interactions in this run


# ---------------------------------------------------------------------------
# Run state contract (Person A owns, Person C renders, Person B contributes)
# ---------------------------------------------------------------------------

class CostCounters(BaseModel):
    model_calls: int = 0
    seconds: float = 0.0


class NodeState(BaseModel):
    status: str = "pending"      # "pending" | "running" | "success" | "failed" | "skipped"
    summary: str = ""


class RunEvent(BaseModel):
    ts: str                      # ISO timestamp
    node_id: str
    type: str                    # "node_started" | "node_completed" | "node_failed"
    payload: dict = Field(default_factory=dict)


class CriterionResult(BaseModel):
    id: str
    description: str
    command: str
    type: str = "command"              # "test" | "lint" | "command"
    status: str = ""                   # "pass" | "fail" | "error"
    exit_code: int | None = None
    expected_exit_code: int = 0
    duration_s: float = 0.0
    evidence: str = ""


class RunState(BaseModel):
    run_id: str
    status: str                  # "running" | "success" | "stopped" | "failed"
    attempt: int                 # 1-indexed
    max_attempts: int
    started_at: str              # ISO timestamp
    cost: CostCounters = Field(default_factory=CostCounters)
    node_states: dict[str, NodeState] = Field(default_factory=dict)
    events: list[RunEvent] = Field(default_factory=list)
    criteria: list[CriterionResult] = Field(default_factory=list)

    def save(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(self.model_dump_json(indent=2))

    @classmethod
    def load(cls, path: Path) -> RunState:
        return cls.model_validate_json(path.read_text())


# ---------------------------------------------------------------------------
# Workflow contract (Person B creates, Person A executes, Person C edits)
# ---------------------------------------------------------------------------

class WorkflowNode(BaseModel):
    id: str
    type: str                    # "input" | "agent" | "command" | "validator" | "decision" | "human_gate" | "terminal"
    name: str
    config: dict = Field(default_factory=dict)


class WorkflowEdge(BaseModel):
    from_node: str = Field(alias="from")
    to_node: str = Field(alias="to")
    on: str = "success"          # "success" | "failure" | "max_attempts"

    model_config = {"populate_by_name": True}


class Workflow(BaseModel):
    name: str
    nodes: list[WorkflowNode]
    edges: list[WorkflowEdge]
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
        """Follow edges from current_id based on outcome."""
        for e in self.edges:
            if e.from_node == current_id and e.on == outcome:
                return e.to_node
        return None

    def entry_node(self) -> str:
        return self.nodes[0].id if self.nodes else ""
