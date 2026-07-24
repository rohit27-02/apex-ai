"""Validator handler.

Runs each criterion's shell command, checks exit codes, records pass/fail.
ZERO LLM — pure subprocess execution.

This is the heart of the system: the LLM can NEVER turn a red check green.
"""

from __future__ import annotations

import subprocess
import time
from pathlib import Path

from contracts.models import WorkflowNode, RunState, Criterion, CriterionStatus


def handle(node: WorkflowNode, run: RunState, repo_path: str) -> dict:
    """Run all criteria and determine pass/fail."""
    results = []

    for criterion in run.criteria:
        result = _run_criterion(criterion, repo_path)
        results.append(result)

    # Update criteria in run state
    run.criteria = results

    # Determine overall verdict
    all_passed = all(r.status == CriterionStatus.passed for r in results)
    passed_count = sum(1 for r in results if r.status == CriterionStatus.passed)

    return {
        "status": "success" if all_passed else "failed",
        "summary": f"{passed_count}/{len(results)} criteria passed",
        "criteria_results": [
            {"id": r.id, "status": r.status.value, "exit_code": None}
            for r in results
        ],
    }


def _run_criterion(criterion: Criterion, repo_path: str) -> Criterion:
    """Run a single criterion's command."""
    start = time.monotonic()

    try:
        proc = subprocess.run(
            criterion.command,
            cwd=repo_path,
            shell=True,
            capture_output=True,
            text=True,
            timeout=120,
            check=False,
        )
        exit_code = proc.returncode
        status = CriterionStatus.passed if exit_code == criterion.expect_exit_code else CriterionStatus.failed

    except subprocess.TimeoutExpired:
        exit_code = -1
        status = CriterionStatus.failed
    except OSError:
        exit_code = -1
        status = CriterionStatus.failed

    return Criterion(
        id=criterion.id,
        description=criterion.description,
        command=criterion.command,
        expect_exit_code=criterion.expect_exit_code,
        status=status,
    )
