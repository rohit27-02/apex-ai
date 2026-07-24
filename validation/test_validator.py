"""Self-test for the deterministic validator.

Proves the property that matters: the verdict is a pure function of exit
codes. Uses trivial cross-platform commands (python -c 'sys.exit(N)') so it
never depends on the target repo or git.

Run:  python -m pytest validation/test_validator.py -q   (from repo root)
"""

import sys

from validation.validator import check, run_criterion

PY = sys.executable


def _cmd(code: int) -> str:
    return f'"{PY}" -c "import sys; sys.exit({code})"'


def test_exit_zero_passes(tmp_path):
    result = run_criterion(
        {"id": "ok", "description": "d", "command": _cmd(0)}, tmp_path
    )
    assert result["status"] == "pass"
    assert result["exit_code"] == 0


def test_nonzero_fails(tmp_path):
    result = run_criterion(
        {"id": "bad", "description": "d", "command": _cmd(1)}, tmp_path
    )
    assert result["status"] == "fail"
    assert result["exit_code"] == 1


def test_custom_expected_exit_code(tmp_path):
    result = run_criterion(
        {"id": "x", "description": "d", "command": _cmd(3), "expect_exit_code": 3},
        tmp_path,
    )
    assert result["status"] == "pass"


def test_verdict_is_all_pass(tmp_path):
    report = check(
        [
            {"id": "a", "description": "d", "command": _cmd(0)},
            {"id": "b", "description": "d", "command": _cmd(0)},
        ],
        tmp_path,
    )
    assert report["passed"] is True
    assert report["verdict"] == "pass"


def test_one_failure_fails_verdict(tmp_path):
    report = check(
        [
            {"id": "a", "description": "d", "command": _cmd(0)},
            {"id": "b", "description": "d", "command": _cmd(1)},
        ],
        tmp_path,
    )
    assert report["passed"] is False
    assert report["passed_count"] == 1


def test_timeout_is_reported_as_error(tmp_path):
    slow = f'"{PY}" -c "import time; time.sleep(5)"'
    result = run_criterion(
        {"id": "slow", "description": "d", "command": slow, "timeout": 1}, tmp_path
    )
    assert result["status"] == "error"
    assert "TIMEOUT" in result["evidence"]


def test_determinism_same_state_same_verdict(tmp_path):
    criteria = [
        {"id": "a", "description": "d", "command": _cmd(0)},
        {"id": "b", "description": "d", "command": _cmd(1)},
    ]
    first = check(criteria, tmp_path)
    second = check(criteria, tmp_path)
    assert first["verdict"] == second["verdict"]
    assert [c["status"] for c in first["criteria"]] == [
        c["status"] for c in second["criteria"]
    ]
