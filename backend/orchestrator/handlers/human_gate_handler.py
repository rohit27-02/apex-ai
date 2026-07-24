"""Human gate handler — pauses for approval on high-risk changes.

In POC/auto mode (ctx.auto_approve=True) the gate approves immediately so the
demo runs unattended. With auto_approve=False it emits an AWAITING outcome; the
engine sets run.status='awaiting_approval' and returns, and the API resumes the
run via Orchestrator.resume(approved=...).

A rejected gate ends the run in Stopped Safely (handled by the engine).
"""

from __future__ import annotations

from backend.contracts.models import NodeStatus, WorkflowNode
from backend.orchestrator.context import AWAITING, SUCCESS, HandlerContext, HandlerResult
from backend.orchestrator.state import EventType, mark_node


def handle_human_gate(node: WorkflowNode, ctx: HandlerContext) -> HandlerResult:
    run = ctx.run

    if ctx.auto_approve:
        mark_node(run, node.id, NodeStatus.success, "auto-approved")
        run.emit(node.id, EventType.HUMAN_GATE_APPROVED, {"auto": True})
        return HandlerResult(SUCCESS, "auto-approved")

    # Real pause: leave the node running and hand control back to the caller.
    mark_node(run, node.id, NodeStatus.running, "awaiting approval")
    run.emit(node.id, EventType.HUMAN_GATE_AWAITING, {"attempt": run.attempt})
    return HandlerResult(AWAITING, "awaiting approval")
