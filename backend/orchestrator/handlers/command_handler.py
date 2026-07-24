"""Command handler — runs a build/test/repo command from node config.

Deterministic like the validator: outcome is decided purely by the exit code.
Used for standalone Command nodes (e.g. a build step) that aren't part of the
criteria set.
"""

from __future__ import annotations

import subprocess

from backend.contracts.models import NodeStatus, WorkflowNode
from backend.orchestrator.context import FAILURE, SUCCESS, HandlerContext, HandlerResult
from backend.orchestrator.state import EventType, mark_node, sanitize_output


def handle_command(node: WorkflowNode, ctx: HandlerContext) -> HandlerResult:
    run = ctx.run
    command = node.config.get("command", "")
    expect = node.config.get("expect_exit_code", 0)
    mark_node(run, node.id, NodeStatus.running)

    if not command:
        summary = "no command configured"
        mark_node(run, node.id, NodeStatus.failed, summary)
        return HandlerResult(FAILURE, summary)

    try:
        proc = subprocess.run(
            command, cwd=ctx.repo_path, shell=True,
            capture_output=True, text=True, timeout=node.config.get("timeout", 120),
        )
        exit_code = proc.returncode
        output = sanitize_output((proc.stdout or "") + (proc.stderr or ""))[-2000:]
    except subprocess.TimeoutExpired:
        exit_code, output = 124, "command timed out"
    except Exception as exc:
        exit_code, output = 127, f"command error: {exc}"

    run.emit(node.id, EventType.COMMAND_EXECUTED,
             {"command": command, "exit_code": exit_code})

    if exit_code == expect:
        summary = f"exit {exit_code} (ok)"
        mark_node(run, node.id, NodeStatus.success, summary)
        return HandlerResult(SUCCESS, summary, {"exit_code": exit_code, "output": output})

    summary = f"exit {exit_code} (expected {expect})"
    mark_node(run, node.id, NodeStatus.failed, summary)
    return HandlerResult(FAILURE, summary, {"exit_code": exit_code, "output": output})
