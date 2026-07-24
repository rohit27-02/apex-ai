"""Validator handler — THE deterministic acceptance gate.

======================================================================
 NO LLM IN THIS FILE. The verdict is all(exit_code == expect_exit_code).
 An LLM's opinion, however confident, must never turn a red check green.
 Given the same repo state, this produces the identical verdict every time.
======================================================================

The only place an LLM is allowed near a failure is AFTER the verdict: the first
failing criterion's captured output is stashed into ctx.last_failure so the
Planning agent can propose a fix. That feedback is advisory, never authoritative.
"""

from __future__ import annotations

import subprocess
import time

from backend.contracts.models import CriterionStatus, NodeStatus, WorkflowNode
from backend.orchestrator.context import FAILURE, SUCCESS, HandlerContext, HandlerResult
from backend.orchestrator.state import EventType, mark_node, sanitize_output

_OUTPUT_LIMIT = 2000  # truncate captured evidence to the last ~2KB


def _run_command(command: str, cwd: str, timeout: int = 120) -> tuple[int, str]:
    """Run a criterion command, return (exit_code, combined_output_tail)."""
    try:
        proc = subprocess.run(
            command,
            cwd=cwd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        output = sanitize_output((proc.stdout or "") + (proc.stderr or ""))
        return proc.returncode, output[-_OUTPUT_LIMIT:]
    except subprocess.TimeoutExpired:
        return 124, f"command timed out after {timeout}s"
    except Exception as exc:  # command not found, etc.
        return 127, f"command error: {exc}"


def handle_validator(node: WorkflowNode, ctx: HandlerContext) -> HandlerResult:
    run = ctx.run
    mark_node(run, node.id, NodeStatus.running)
    run.emit(node.id, EventType.VALIDATION_STARTED, {"attempt": run.attempt})
    # Fresh logs for this attempt; record each deterministic check + evidence.
    run.clear_logs(node.id)
    run.append_log(node.id, f"$ validate (attempt {run.attempt}) — verdict = all(exit_code == expected)")

    first_failure: dict | None = None
    passed = 0

    for crit in run.criteria:
        start = time.monotonic()
        run.append_log(node.id, f"$ {crit.command}")
        exit_code, evidence = _run_command(crit.command, ctx.repo_path)
        crit.duration_s = round(time.monotonic() - start, 3)
        crit.exit_code = exit_code
        crit.evidence = evidence

        if exit_code == crit.expect_exit_code:
            crit.status = CriterionStatus.passed
            passed += 1
            run.append_log(node.id, f"  ✓ {crit.id} passed (exit {exit_code})")
            run.emit(node.id, EventType.CRITERION_PASSED,
                     {"criterion": crit.id, "exit_code": exit_code})
        else:
            crit.status = CriterionStatus.failed
            run.append_log(node.id,
                           f"  ✗ {crit.id} FAILED (exit {exit_code}, expected {crit.expect_exit_code})")
            for ev_line in evidence.strip().splitlines()[-20:]:
                run.append_log(node.id, f"    {ev_line}")
            run.emit(node.id, EventType.CRITERION_FAILED, {
                "criterion": crit.id,
                "exit_code": exit_code,
                "expected": crit.expect_exit_code,
                "evidence": evidence[-1200:],
            })
            if first_failure is None:
                first_failure = {
                    "criterion_id": crit.id,
                    "description": crit.description,
                    "command": crit.command,
                    "evidence": evidence,
                }

    total = len(run.criteria)
    verdict_pass = first_failure is None and total > 0

    if verdict_pass:
        ctx.last_failure = None
        summary = f"All {total} criteria passed"
        mark_node(run, node.id, NodeStatus.success, summary)
        return HandlerResult(SUCCESS, summary)

    # Stash the first failure as advisory feedback for the next planning attempt.
    ctx.last_failure = first_failure
    summary = f"{passed}/{total} criteria passed — failed: {first_failure['criterion_id'] if first_failure else 'none'}"
    mark_node(run, node.id, NodeStatus.failed, summary)
    return HandlerResult(FAILURE, summary, {"failure": first_failure})
