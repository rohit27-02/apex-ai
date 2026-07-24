"""Terminal handlers — Success and Stop nodes end the run.

Success: reached only through a passed validation + approved human gate. Sets
run.status='success' and delivered=True — the ONLY place delivered becomes true.

Stop: a safe termination. Sets run.status='stopped_safely', delivered stays
false. (Budget-exhaustion rollback is driven by the engine, which routes here.)
"""

from __future__ import annotations

from backend.contracts.models import NodeStatus, NodeType, RunStatus, WorkflowNode
from backend.orchestrator.context import SUCCESS, HandlerContext, HandlerResult
from backend.orchestrator.state import EventType, mark_node


def handle_terminal(node: WorkflowNode, ctx: HandlerContext) -> HandlerResult:
    run = ctx.run

    if node.type == NodeType.success:
        run.status = RunStatus.success
        run.delivered = True
        mark_node(run, node.id, NodeStatus.success, "delivered")
        run.emit(node.id, EventType.RUN_SUCCEEDED,
                 {"attempt": run.attempt, "delivered": True})
        return HandlerResult(SUCCESS, "task successful")

    # Stop node
    run.status = RunStatus.stopped_safely
    run.delivered = False
    mark_node(run, node.id, NodeStatus.success, "stopped safely")
    run.emit(node.id, EventType.RUN_STOPPED_SAFELY,
             {"attempt": run.attempt, "delivered": False})
    return HandlerResult(SUCCESS, "stopped safely")
