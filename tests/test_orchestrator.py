"""End-to-end orchestrator tests — the loop machinery, proven deterministically.

No API keys needed: a ScriptedRunner stands in for the agent, doing real file
edits on a real temp repo so the deterministic validator has something to judge.

Covered:
  - fail attempt 1 -> feedback -> pass attempt 2 -> human gate -> success (delivered)
  - budget exhausted -> rollback -> green verification -> stopped safely (undelivered)
  - identical verdict on identical state (acceptance is a pure function of exit codes)
  - git rollback actually restores a clean working tree
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from backend.contracts.models import (
    RunnerResult,
    RunStatus,
    Workflow,
    WorkflowEdge,
    WorkflowNode,
)
from backend.orchestrator import Orchestrator

# ---------------------------------------------------------------------------
# A scripted runner: real file edits, no LLM. Fixes the repo on a chosen attempt.
# ---------------------------------------------------------------------------

class ScriptedRunner:
    def __init__(self, fix_on_attempt: int = 2) -> None:
        self.fix_on_attempt = fix_on_attempt
        self.exec_calls = 0
        self.model_calls_total = 0

    def run(self, prompt: str, cwd: str, tools=None) -> RunnerResult:
        run_dir = Path(cwd) / ".run_output"
        run_dir.mkdir(parents=True, exist_ok=True)
        transcript = run_dir / "transcript.jsonl"
        transcript.write_text('{"type": "assistant", "content": "scripted"}\n')
        self.model_calls_total += 1

        files: list[str] = []
        if "Execution Agent" in prompt:
            self.exec_calls += 1
            if self.exec_calls >= self.fix_on_attempt:
                (Path(cwd) / "marker.txt").write_text("fixed")
                files = ["marker.txt"]
        return RunnerResult(
            transcript_path=str(transcript),
            files_changed=files,
            status="success",
            model_calls=1,
        )


def build_workflow(criteria: list[dict], max_attempts: int = 3) -> Workflow:
    """The default 4-agent loop with a human gate and terminals."""
    return Workflow(
        name="default-loop",
        entryNode="criteria",
        max_attempts=max_attempts,
        nodes=[
            WorkflowNode(id="criteria",   type="agent",      name="Criteria",
                         config={"role": "criteria", "criteria": criteria}),
            WorkflowNode(id="planning",   type="agent",      name="Planning",   config={"role": "planning"}),
            WorkflowNode(id="execution",  type="agent",      name="Execution",  config={"role": "execution"}),
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
    )


MARKER_CRITERION = [{
    "id": "c1",
    "description": "marker.txt exists",
    "command": "test -f marker.txt",
    "expect_exit_code": 0,
}]


def _event_types(run) -> list[str]:
    return [e.type for e in run.events]


# ---------------------------------------------------------------------------
# 1. Fail -> feedback -> pass -> success
# ---------------------------------------------------------------------------

class TestFailThenSucceed:
    def test_second_attempt_succeeds(self, tmp_path: Path) -> None:
        wf = build_workflow(MARKER_CRITERION, max_attempts=3)
        runner = ScriptedRunner(fix_on_attempt=2)
        orch = Orchestrator(wf, runner=runner, repo_path=str(tmp_path),
                            objective="create marker.txt", auto_approve=True)
        run = orch.run_to_completion()

        assert run.status == RunStatus.success
        assert run.delivered is True
        assert run.attempt == 2, "should have taken exactly two attempts"

    def test_failure_feedback_recorded(self, tmp_path: Path) -> None:
        wf = build_workflow(MARKER_CRITERION, max_attempts=3)
        orch = Orchestrator(wf, runner=ScriptedRunner(fix_on_attempt=2),
                            repo_path=str(tmp_path), objective="x")
        run = orch.run_to_completion()
        types = _event_types(run)
        assert "criterion_failed" in types      # attempt 1 red
        assert "retry_triggered" in types       # feedback fed back
        assert "criterion_passed" in types       # attempt 2 green
        assert "run_succeeded" in types

    def test_cost_counters_accumulate(self, tmp_path: Path) -> None:
        wf = build_workflow(MARKER_CRITERION, max_attempts=3)
        orch = Orchestrator(wf, runner=ScriptedRunner(fix_on_attempt=2),
                            repo_path=str(tmp_path), objective="x")
        run = orch.run_to_completion()
        # planning+execution called across 2 attempts -> >= 4 model calls
        assert run.cost.model_calls >= 4
        assert run.cost.seconds >= 0.0

    def test_criteria_confirmed_before_run(self, tmp_path: Path) -> None:
        wf = build_workflow(MARKER_CRITERION, max_attempts=3)
        orch = Orchestrator(wf, runner=ScriptedRunner(fix_on_attempt=1),
                            repo_path=str(tmp_path), objective="x")
        run = orch.run_to_completion()
        assert len(run.criteria) == 1
        assert run.criteria[0].id == "c1"


# ---------------------------------------------------------------------------
# 2. Budget exhausted -> rollback -> green -> stopped safely
# ---------------------------------------------------------------------------

class TestBoundedRetreat:
    def test_exhaustion_stops_safely(self, tmp_path: Path) -> None:
        wf = build_workflow(MARKER_CRITERION, max_attempts=2)
        orch = Orchestrator(wf, runner=ScriptedRunner(fix_on_attempt=99),
                            repo_path=str(tmp_path), objective="x")
        run = orch.run_to_completion()

        assert run.status in (RunStatus.stopped_safely, RunStatus.rolled_back)
        assert run.delivered is False
        assert run.attempt == 2

    def test_rollback_and_verification_receipts(self, tmp_path: Path) -> None:
        wf = build_workflow(MARKER_CRITERION, max_attempts=2)
        orch = Orchestrator(wf, runner=ScriptedRunner(fix_on_attempt=99),
                            repo_path=str(tmp_path), objective="x")
        run = orch.run_to_completion()
        types = _event_types(run)
        assert "rollback_started" in types
        assert "rollback_completed" in types
        assert "post_rollback_verification_passed" in types
        assert "run_stopped_safely" in types


# ---------------------------------------------------------------------------
# 3. Deterministic acceptance — same state, same verdict
# ---------------------------------------------------------------------------

class TestDeterministicVerdict:
    def test_same_state_same_verdict(self, tmp_path: Path) -> None:
        from backend.contracts.models import Criterion, CriterionStatus
        from backend.orchestrator.context import HandlerContext
        from backend.orchestrator.handlers.validator_handler import handle_validator
        from backend.orchestrator.state.run_state import init_run_state

        wf = build_workflow(MARKER_CRITERION, max_attempts=1)
        (tmp_path / "marker.txt").write_text("fixed")  # green state

        def verdict() -> CriterionStatus:
            run = init_run_state(wf, "x", 1)
            run.attempt = 1
            run.criteria = [Criterion(id="c1", description="m", command="test -f marker.txt")]
            ctx = HandlerContext(workflow=wf, run=run, runner=ScriptedRunner(),
                                 repo_path=str(tmp_path), prompts_dir=Path("."))
            handle_validator(wf.get_node("validation"), ctx)
            return run.criteria[0].status

        assert verdict() == CriterionStatus.passed
        assert verdict() == CriterionStatus.passed  # identical, every time


# ---------------------------------------------------------------------------
# 4. Real git rollback restores a clean tree
# ---------------------------------------------------------------------------

def _git(cwd: Path, *args: str) -> str:
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True).stdout


@pytest.fixture()
def git_repo(tmp_path: Path) -> Path:
    subprocess.run(["git", "init", "-q"], cwd=tmp_path, capture_output=True)
    subprocess.run(["git", "config", "user.email", "t@t.co"], cwd=tmp_path, capture_output=True)
    subprocess.run(["git", "config", "user.name", "t"], cwd=tmp_path, capture_output=True)
    (tmp_path / "data.txt").write_text("base\n")
    subprocess.run(["git", "add", "-A"], cwd=tmp_path, capture_output=True)
    subprocess.run(["git", "commit", "-qm", "baseline"], cwd=tmp_path, capture_output=True)
    return tmp_path


class TestGitRollback:
    def test_working_tree_clean_after_exhaustion(self, git_repo: Path) -> None:
        # criterion never satisfiable; runner dirties the tree each attempt
        criteria = [{"id": "c1", "description": "feature present",
                     "command": "grep -q FEATURE data.txt", "expect_exit_code": 0}]
        wf = build_workflow(criteria, max_attempts=2)

        class DirtyRunner(ScriptedRunner):
            def run(self, prompt, cwd, tools=None):
                if "Execution Agent" in prompt:
                    p = Path(cwd) / "data.txt"
                    p.write_text(p.read_text() + "BROKEN\n")  # dirty, never adds FEATURE
                return super().run(prompt, cwd, tools)

        orch = Orchestrator(
            wf, runner=DirtyRunner(fix_on_attempt=99), repo_path=str(git_repo),
            objective="x", green_command='test "$(cat data.txt)" = "base"',
        )
        run = orch.run_to_completion()

        assert run.status == RunStatus.rolled_back
        assert run.delivered is False
        # git tree is clean and file restored to baseline
        assert _git(git_repo, "status", "--porcelain").strip() == ""
        assert (git_repo / "data.txt").read_text() == "base\n"
        assert "post_rollback_verification_passed" in _event_types(run)


# ---------------------------------------------------------------------------
# 5. Decision-routed loop — Person C's canvas default graph shape
#    (validator has NO failure edge; the Decision node routes the retry)
# ---------------------------------------------------------------------------

def build_canvas_workflow(criteria: list[dict], max_attempts: int = 3) -> Workflow:
    """Mirrors the frontend DEFAULT_WORKFLOW topology."""
    return Workflow(
        name="canvas-default",
        entryNode="input",
        max_attempts=max_attempts,
        nodes=[
            WorkflowNode(id="input",      type="input",      name="Coding Objective"),
            WorkflowNode(id="criteria",   type="agent",      name="Success Criteria Agent",
                         config={"role": "criteria", "criteria": criteria}),
            WorkflowNode(id="planning",   type="agent",      name="Planning Agent",   config={"role": "planning"}),
            WorkflowNode(id="execution",  type="agent",      name="Execution Agent",  config={"role": "execution"}),
            WorkflowNode(id="validation", type="validator",  name="Validation Agent"),
            WorkflowNode(id="decision",   type="decision",   name="Pass / Fail?"),
            WorkflowNode(id="human-gate", type="human_gate", name="Human Approval"),
            WorkflowNode(id="success",    type="success",    name="Task Complete"),
            WorkflowNode(id="stop",       type="stop",       name="Stopped Safely"),
        ],
        edges=[
            WorkflowEdge(source="input",      target="criteria",   on="success"),
            WorkflowEdge(source="criteria",   target="planning",   on="success"),
            WorkflowEdge(source="planning",   target="execution",  on="success"),
            WorkflowEdge(source="execution",  target="validation", on="success"),
            WorkflowEdge(source="validation", target="decision",   on="success"),
            WorkflowEdge(source="decision",   target="human-gate", on="success"),
            WorkflowEdge(source="decision",   target="planning",   on="failure"),
            WorkflowEdge(source="human-gate", target="success",    on="success"),
        ],
    )


class TestDecisionRoutedLoop:
    def test_fail_then_pass_through_decision(self, tmp_path: Path) -> None:
        wf = build_canvas_workflow(MARKER_CRITERION, max_attempts=3)
        orch = Orchestrator(wf, runner=ScriptedRunner(fix_on_attempt=2),
                            repo_path=str(tmp_path), objective="x", auto_approve=True)
        run = orch.run_to_completion()
        assert run.status == RunStatus.success
        assert run.delivered is True
        assert run.attempt == 2
        assert "retry_triggered" in _event_types(run)

    def test_exhaustion_through_decision(self, tmp_path: Path) -> None:
        wf = build_canvas_workflow(MARKER_CRITERION, max_attempts=2)
        orch = Orchestrator(wf, runner=ScriptedRunner(fix_on_attempt=99),
                            repo_path=str(tmp_path), objective="x")
        run = orch.run_to_completion()
        assert run.status in (RunStatus.stopped_safely, RunStatus.rolled_back)
        assert run.delivered is False
        assert run.attempt == 2
        assert "rollback_completed" in _event_types(run)

    def test_gate_pause_and_resume_on_canvas_graph(self, tmp_path: Path) -> None:
        wf = build_canvas_workflow(MARKER_CRITERION, max_attempts=3)
        orch = Orchestrator(wf, runner=ScriptedRunner(fix_on_attempt=1),
                            repo_path=str(tmp_path), objective="x", auto_approve=False)
        run = orch.run_to_completion()
        assert run.status == RunStatus.awaiting_approval
        assert orch.paused_node == "human-gate"
        run = orch.resume(approved=True)
        assert run.status == RunStatus.success
        assert run.delivered is True

    def test_dead_end_graph_never_stuck_running(self, tmp_path: Path) -> None:
        """A graph with no route out of a failure must stop honestly, not hang."""
        wf = Workflow(
            name="dead-end", entryNode="criteria", max_attempts=2,
            nodes=[
                WorkflowNode(id="criteria", type="agent",
                             config={"role": "criteria", "criteria": MARKER_CRITERION}),
                WorkflowNode(id="validation", type="validator"),
            ],
            edges=[WorkflowEdge(source="criteria", target="validation", on="success")],
        )
        orch = Orchestrator(wf, runner=ScriptedRunner(fix_on_attempt=99),
                            repo_path=str(tmp_path), objective="x")
        run = orch.run_to_completion()
        assert run.status in (RunStatus.stopped_safely, RunStatus.rolled_back)
        assert run.delivered is False
