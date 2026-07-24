"""Standalone test for Person B's runner components.

Run: py -3.11 test_runners.py

Tests:
1. RunnerResult serialization round-trip
2. StubRunner produces valid output
3. Default workflow loads and traverses correctly
4. Workflow save/load round-trip
5. RunState save/load round-trip
6. All prompt files exist and are readable
"""

import json
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from contracts.models import (
    RunnerResult, Workflow, RunState, RunStatus, NodeStatus, NodeType,
    EdgeOutcome, CriterionStatus, NodeState, Event, Criterion,
)
from runners.stub_runner import StubRunner


def test_runner_result_roundtrip():
    """RunnerResult survives serialization."""
    result = RunnerResult(
        transcript_path="/tmp/transcript.jsonl",
        files_changed=["app/main.py", "tests/test_main.py"],
        status="success",
        model_calls=5,
    )
    d = result.model_dump()
    restored = RunnerResult.model_validate(d)
    assert restored.transcript_path == result.transcript_path
    assert restored.files_changed == result.files_changed
    assert restored.status == result.status
    assert restored.model_calls == result.model_calls
    print("PASS: RunnerResult round-trip")


def test_stub_runner():
    """StubRunner produces valid output in a temp directory."""
    with tempfile.TemporaryDirectory() as tmpdir:
        runner = StubRunner(fake_model_calls=2)
        result = runner.run(prompt="Add pagination to GET /todos", cwd=tmpdir)

        assert isinstance(result, RunnerResult)
        assert result.status == "success"
        assert result.model_calls == 2
        assert len(result.files_changed) > 0
        assert Path(result.transcript_path).exists()

        # Verify transcript is valid JSONL
        with open(result.transcript_path) as f:
            lines = f.readlines()
        assert len(lines) >= 3
        for line in lines:
            obj = json.loads(line)
            assert "ts" in obj
            assert "type" in obj

        print("PASS: StubRunner output")


def test_default_workflow():
    """Default workflow loads and traverses correctly."""
    wf_path = Path(__file__).parent / "workflows" / "default_workflow.json"
    wf = Workflow.model_validate_json(wf_path.read_text())
    assert len(wf.nodes) == 7
    assert len(wf.edges) == 6

    # Entry node
    entry = wf.entryNode
    assert entry == "criteria"

    # Traverse the happy path
    node = entry
    path = [node]
    while node:
        next_id = wf.next_node(node, EdgeOutcome.success)
        if next_id:
            path.append(next_id)
        node = next_id

    assert path == ["criteria", "planning", "execution", "validation", "human_gate", "success"]
    print("PASS: Workflow traversal")

    # Test failure path from validation
    fail_next = wf.next_node("validation", EdgeOutcome.failure)
    assert fail_next == "planning"
    print("PASS: Workflow edges")


def test_workflow_serialization():
    """Workflow survives save/load round-trip."""
    wf_path = Path(__file__).parent / "workflows" / "default_workflow.json"
    wf = Workflow.model_validate_json(wf_path.read_text())

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        tmppath = Path(f.name)

    wf.save(tmppath)
    loaded = Workflow.load(tmppath)
    assert loaded.entryNode == wf.entryNode
    assert len(loaded.nodes) == len(wf.nodes)
    assert len(loaded.edges) == len(wf.edges)
    tmppath.unlink()
    print("PASS: Workflow round-trip")


def test_run_state_serialization():
    """RunState survives save/load round-trip."""
    now = datetime.now(timezone.utc)
    state = RunState(
        run_id="test-run-001",
        status=RunStatus.running,
        attempt=1,
        max_attempts=3,
        objective="Add pagination",
        started_at=now,
        updated_at=now,
        delivered=False,
        node_states={"criteria": NodeState(status=NodeStatus.success, result_summary="3 criteria defined")},
        events=[Event(timestamp=now, node_id="criteria", type="node_started")],
        criteria=[Criterion(id="c1", description="Tests pass", command="pytest -q", expect_exit_code=0, status=CriterionStatus.pending)],
    )

    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as f:
        tmppath = Path(f.name)

    state.save(tmppath)
    loaded = RunState.load(tmppath)
    assert loaded.run_id == "test-run-001"
    assert loaded.status == RunStatus.running
    assert loaded.objective == "Add pagination"
    assert len(loaded.events) == 1
    assert len(loaded.criteria) == 1
    tmppath.unlink()
    print("PASS: RunState round-trip")


def test_prompt_files_exist():
    """All four prompt files exist and contain content."""
    prompts_dir = Path(__file__).parent / "prompts"
    required = ["criteria.txt", "planning.txt", "execution.txt", "retry_planning.txt"]
    for name in required:
        path = prompts_dir / name
        assert path.exists(), f"Missing prompt: {path}"
        content = path.read_text()
        assert len(content) > 100, f"Prompt too short: {path}"
        assert "Output" in content or "output" in content, f"Prompt missing output spec: {path}"
    print("PASS: All prompt files present")


def test_person_a_compatibility():
    """Verify our contracts match Person A's sample_run.json format."""
    fixture_path = Path(__file__).parent / "person_a" / "apex-ai" / "fixtures" / "sample_run.json"
    if not fixture_path.exists():
        print("SKIP: Person A fixtures not found")
        return

    data = json.loads(fixture_path.read_text())
    # Should parse without errors using our RunState model
    run = RunState.model_validate(data)
    assert run.run_id == "__RUN_ID__"
    assert run.status == RunStatus.awaiting_approval
    assert run.attempt == 2
    assert run.max_attempts == 3
    assert len(run.events) > 0
    assert len(run.criteria) > 0
    assert run.criteria[0].status == CriterionStatus.passed
    print("PASS: Person A compatibility")


if __name__ == "__main__":
    print("=" * 60)
    print("Person B — Runner Component Tests")
    print("=" * 60)

    tests = [
        test_runner_result_roundtrip,
        test_stub_runner,
        test_default_workflow,
        test_workflow_serialization,
        test_run_state_serialization,
        test_prompt_files_exist,
        test_person_a_compatibility,
    ]

    passed = 0
    failed = 0
    for test in tests:
        try:
            test()
            passed += 1
        except Exception as e:
            print(f"FAIL: {test.__name__}: {e}")
            failed += 1

    print("=" * 60)
    print(f"Results: {passed} passed, {failed} failed")
    print("=" * 60)
    sys.exit(1 if failed else 0)
