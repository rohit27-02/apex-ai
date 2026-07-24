"""Validator handler.

Runs each criterion's shell command, checks exit codes, records pass/fail.
ZERO LLM — pure subprocess execution.
"""

from __future__ import annotations

import subprocess
import time
from pathlib import Path

from contracts.models import WorkflowNode, RunState, Criterion, CriterionStatus


def handle_validator(node: WorkflowNode, run: RunState, repo_path: str) -> dict:
    """Run all criteria and determine pass/fail."""
    results = []

    for criterion in run.criteria:
        result = _run_criterion(criterion, repo_path)
        results.append(result)

    # Update criteria in run state
    run.criteria = results

    # Determine overall verdict
    all_passed = all(r.status == CriterionStatus.passed for r in results)

    return {
        "status": "success" if all_passed else "failed",
        "summary": f"{sum(1 for r in results if r.status == CriterionStatus.passed)}/{len(results)} passed",
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
        duration = round(time.monotonic() - start, 3)
        exit_code = proc.returncode
        status = CriterionStatus.passed if exit_code == criterion.expect_exit_code else CriterionStatus.failed
        evidence = (proc.stdout + proc.stderr)[-2000:]

    except subprocess.TimeoutExpired:
        duration = round(time.monotonic() - start, 3)
        exit_code = -1
        status = CriterionStatus.failed
        evidence = f"TIMEOUT after 120s"
    except OSError as exc:
        duration = round(time.monotonic() - start, 3)
        exit_code = -1
        status = CriterionStatus.failed
        evidence = f"failed to launch: {exc}"

    return Criterion(
        id=criterion.id,
        description=criterion.description,
        command=criterion.command,
        expect_exit_code=criterion.expect_exit_code,
        status=status,
    )
