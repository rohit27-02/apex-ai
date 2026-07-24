"""Input handler — seeds the run with the objective and constraints.

The objective is already on the RunState; this node makes the starting point
explicit on the canvas and records any constraints from its config.
"""

from __future__ import annotations

from backend.contracts.models import NodeStatus, WorkflowNode
from backend.orchestrator.context import SUCCESS, HandlerContext, HandlerResult
from backend.orchestrator.state import EventType, mark_node


def handle_input(node: WorkflowNode, ctx: HandlerContext) -> HandlerResult:
    run = ctx.run
    mark_node(run, node.id, NodeStatus.running)

    objective = node.config.get("objective") or run.objective
    run.objective = objective
    constraints = node.config.get("constraints", [])

    run.emit(node.id, EventType.RUN_STARTED,
             {"objective": objective, "constraints": constraints})
    summary = "objective received"
    mark_node(run, node.id, NodeStatus.success, summary)
    return HandlerResult(SUCCESS, summary, {"objective": objective})
