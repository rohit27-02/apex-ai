"""Integration tests — Person B's runners wired to Person A's API contract.

Three layers tested:
  1. Runner protocol compliance (StubRunner satisfies the Runner Protocol)
  2. StubRunner end-to-end (prompt → RunnerResult → transcript on disk)
  3. RunState round-trip (runner output updates RunState; result validates against A's schema)
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import pytest

# Make imports work when run from the apex-ai directory
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.contracts.models import (
    CriterionResult,
    CriterionStatus,
    NodeState,
    NodeStatus,
    RunnerResult,
    RunState,
    RunStatus,
    Workflow,
    WorkflowEdge,
    WorkflowNode,
)
from backend.runners.base import Runner
from backend.runners.stub_runner import StubRunner

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture()
def tmp_repo(tmp_path: Path) -> Path:
    """Minimal git-like repo directory the runner can use as cwd."""
    (tmp_path / "app").mkdir()
    (tmp_path / "app" / "main.py").write_text("# existing code\n")
    return tmp_path


@pytest.fixture()
def stub() -> StubRunner:
    return StubRunner(fake_model_calls=3)


@pytest.fixture()
def sample_run_state() -> RunState:
    now = datetime.now(timezone.utc)
    return RunState(
        run_id="test-run-001",
        status=RunStatus.running,
        attempt=1,
        max_attempts=3,
        objective="Add pagination and status filtering to GET /todos",
        started_at=now,
        updated_at=now,
        node_states={
            "criteria":   NodeState(status=NodeStatus.success),
            "planning":   NodeState(status=NodeStatus.success),
            "execution":  NodeState(status=NodeStatus.running),
            "validation": NodeState(status=NodeStatus.pending),
            "human_gate": NodeState(status=NodeStatus.pending),
            "success":    NodeState(status=NodeStatus.pending),
            "stop":       NodeState(status=NodeStatus.skipped),
        },
        criteria=[
            CriterionResult(id="c1", description="Tests pass",  command="pytest -q",      expect_exit_code=0, status=CriterionStatus.pending),
            CriterionResult(id="c2", description="Lint passes", command="ruff check .",   expect_exit_code=0, status=CriterionStatus.pending),
        ],
    )


@pytest.fixture()
def default_workflow() -> Workflow:
    return Workflow(
        name="default",
        entryNode="criteria",
        nodes=[
            WorkflowNode(id="criteria",   type="agent",      name="Success Criteria"),
            WorkflowNode(id="planning",   type="agent",      name="Planning"),
            WorkflowNode(id="execution",  type="agent",      name="Execution"),
            WorkflowNode(id="validation", type="validator",  name="Validation"),
            WorkflowNode(id="human_gate", type="human_gate", name="Human Gate"),
            WorkflowNode(id="success",    type="success",    name="Success"),
            WorkflowNode(id="stop",       type="stop",       name="Stop"),
        ],
        edges=[
            WorkflowEdge(source="criteria",   target="planning",   on="success"),
            WorkflowEdge(source="planning",   target="execution",  on="success"),
            WorkflowEdge(source="execution",  target="validation", on="success"),
            WorkflowEdge(source="validation", target="human_gate", on="success"),
            WorkflowEdge(source="validation", target="planning",   on="failure"),
            WorkflowEdge(source="human_gate", target="success",    on="success"),
        ],
        max_attempts=3,
    )


# ---------------------------------------------------------------------------
# 1. Protocol compliance
# ---------------------------------------------------------------------------

class TestRunnerProtocol:
    def test_stub_satisfies_runner_protocol(self, stub: StubRunner) -> None:
        assert isinstance(stub, Runner), "StubRunner must satisfy the Runner Protocol"

    def test_runner_result_fields(self, stub: StubRunner, tmp_repo: Path) -> None:
        result = stub.run("Add a feature", cwd=str(tmp_repo))
        assert isinstance(result, RunnerResult)
        assert result.status in ("success", "failed", "timeout")
        assert isinstance(result.files_changed, list)
        assert isinstance(result.model_calls, int) and result.model_calls >= 0
        assert isinstance(result.transcript_path, str)

    def test_transcript_written_to_disk(self, stub: StubRunner, tmp_repo: Path) -> None:
        result = stub.run("Add a feature", cwd=str(tmp_repo))
        assert Path(result.transcript_path).exists(), "transcript must be written to disk"

    def test_transcript_is_valid_jsonl(self, stub: StubRunner, tmp_repo: Path) -> None:
        result = stub.run("Add a feature", cwd=str(tmp_repo))
        lines = Path(result.transcript_path).read_text().strip().splitlines()
        assert lines, "transcript must not be empty"
        for line in lines:
            json.loads(line)  # raises if invalid JSON


# ---------------------------------------------------------------------------
# 2. StubRunner end-to-end
# ---------------------------------------------------------------------------

class TestStubRunnerEndToEnd:
    def test_returns_success_status(self, stub: StubRunner, tmp_repo: Path) -> None:
        result = stub.run("Implement pagination", cwd=str(tmp_repo))
        assert result.status == "success"

    def test_model_calls_matches_constructor(self, tmp_repo: Path) -> None:
        runner = StubRunner(fake_model_calls=7)
        result = runner.run("x", cwd=str(tmp_repo))
        assert result.model_calls == 7

    def test_prompt_captured_in_transcript(self, stub: StubRunner, tmp_repo: Path) -> None:
        prompt = "Unique prompt string ABC-123"
        result = stub.run(prompt, cwd=str(tmp_repo))
        transcript = Path(result.transcript_path).read_text()
        assert "ABC-123" in transcript, "prompt must appear in transcript"

    def test_run_twice_same_repo(self, stub: StubRunner, tmp_repo: Path) -> None:
        r1 = stub.run("First run", cwd=str(tmp_repo))
        r2 = stub.run("Second run", cwd=str(tmp_repo))
        assert r1.status == "success"
        assert r2.status == "success"

    def test_tools_param_accepted(self, stub: StubRunner, tmp_repo: Path) -> None:
        result = stub.run("prompt", cwd=str(tmp_repo), tools=["Read", "Edit", "Bash"])
        assert result.status == "success"


# ---------------------------------------------------------------------------
# 3. RunState round-trip — runner output → state update → schema-valid JSON
# ---------------------------------------------------------------------------

class TestRunStateRoundTrip:
    def _apply_runner_result(self, state: RunState, result: RunnerResult, node_id: str) -> RunState:
        """Simulates what Person A's orchestrator does after calling Runner.run()."""
        node = state.node_states.get(node_id, NodeState())
        node.status = NodeStatus.success if result.status == "success" else NodeStatus.failed
        node.ended_at = datetime.now(timezone.utc)
        node.result_summary = f"files changed: {', '.join(result.files_changed) or 'none'}"
        state.node_states[node_id] = node

        state.cost.model_calls += result.model_calls
        state.emit(node_id, "files_changed", {"files": result.files_changed})
        state.emit(node_id, "node_finished", {"attempt": state.attempt})
        return state

    def test_apply_runner_result_updates_node(
        self, stub: StubRunner, tmp_repo: Path, sample_run_state: RunState
    ) -> None:
        result = stub.run("Implement pagination", cwd=str(tmp_repo))
        state = self._apply_runner_result(sample_run_state, result, "execution")
        assert state.node_states["execution"].status == NodeStatus.success
        assert state.node_states["execution"].ended_at is not None
        assert state.node_states["execution"].result_summary is not None

    def test_cost_counters_accumulate(
        self, tmp_repo: Path, sample_run_state: RunState
    ) -> None:
        runner = StubRunner(fake_model_calls=5)
        r1 = runner.run("step 1", cwd=str(tmp_repo))
        r2 = runner.run("step 2", cwd=str(tmp_repo))
        self._apply_runner_result(sample_run_state, r1, "planning")
        self._apply_runner_result(sample_run_state, r2, "execution")
        assert sample_run_state.cost.model_calls == 10

    def test_events_appended(
        self, stub: StubRunner, tmp_repo: Path, sample_run_state: RunState
    ) -> None:
        initial_count = len(sample_run_state.events)
        result = stub.run("step", cwd=str(tmp_repo))
        self._apply_runner_result(sample_run_state, result, "execution")
        assert len(sample_run_state.events) > initial_count

    def test_state_serialises_to_valid_json(
        self, stub: StubRunner, tmp_repo: Path, sample_run_state: RunState
    ) -> None:
        result = stub.run("step", cwd=str(tmp_repo))
        self._apply_runner_result(sample_run_state, result, "execution")
        raw = sample_run_state.model_dump_json()
        parsed = json.loads(raw)
        # Verify required schema fields are present
        for field in ("run_id", "status", "attempt", "max_attempts", "objective",
                      "started_at", "updated_at", "delivered", "node_states", "events", "criteria"):
            assert field in parsed, f"RunState JSON missing required field: {field!r}"

    def test_state_round_trips_via_save_load(
        self, stub: StubRunner, tmp_repo: Path, sample_run_state: RunState
    ) -> None:
        result = stub.run("step", cwd=str(tmp_repo))
        self._apply_runner_result(sample_run_state, result, "execution")
        save_path = tmp_repo / "run.json"
        sample_run_state.save(save_path)
        loaded = RunState.load(save_path)
        assert loaded.run_id == sample_run_state.run_id
        assert loaded.status == sample_run_state.status
        assert len(loaded.events) == len(sample_run_state.events)


# ---------------------------------------------------------------------------
# 4. Workflow graph traversal
# ---------------------------------------------------------------------------

class TestWorkflowGraph:
    def test_entry_node(self, default_workflow: Workflow) -> None:
        assert default_workflow.entryNode == "criteria"

    def test_success_path(self, default_workflow: Workflow) -> None:
        assert default_workflow.next_node("criteria",   "success") == "planning"
        assert default_workflow.next_node("planning",   "success") == "execution"
        assert default_workflow.next_node("execution",  "success") == "validation"
        assert default_workflow.next_node("validation", "success") == "human_gate"
        assert default_workflow.next_node("human_gate", "success") == "success"

    def test_failure_retry_path(self, default_workflow: Workflow) -> None:
        assert default_workflow.next_node("validation", "failure") == "planning"

    def test_unknown_edge_returns_none(self, default_workflow: Workflow) -> None:
        assert default_workflow.next_node("success", "success") is None

    def test_get_node_by_id(self, default_workflow: Workflow) -> None:
        node = default_workflow.get_node("execution")
        assert node.type == "agent"

    def test_get_missing_node_raises(self, default_workflow: Workflow) -> None:
        with pytest.raises(KeyError):
            default_workflow.get_node("nonexistent")

    def test_workflow_serialises(self, default_workflow: Workflow) -> None:
        raw = json.loads(default_workflow.model_dump_json())
        assert "entryNode" in raw
        assert len(raw["nodes"]) == 7
        assert len(raw["edges"]) == 6
