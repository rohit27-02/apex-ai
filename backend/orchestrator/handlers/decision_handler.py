"""Decision handler — routes based on a prior result, no model involved.

Most default loops let the Validator node own the branch (pass -> gate,
fail -> planning). A standalone Decision node is for explicit branching: it reads
a value from run state or node config and emits success/failure accordingly.

config options:
    condition: "last_validation" (default) — branch on whether all criteria passed
               "delivered"                 — branch on run.delivered
    (any other value is treated as a truthiness check against node.config)
"""

from __future__ import annotations

from backend.contracts.models import CriterionStatus, NodeStatus, WorkflowNode
from backend.orchestrator.context import FAILURE, SUCCESS, HandlerContext, HandlerResult
from backend.orchestrator.state import mark_node


def handle_decision(node: WorkflowNode, ctx: HandlerContext) -> HandlerResult:
    run = ctx.run
    mark_node(run, node.id, NodeStatus.running)
    condition = node.config.get("condition", "last_validation")

    if condition == "delivered":
        passed = run.delivered
    else:  # last_validation
        passed = bool(run.criteria) and all(
            c.status == CriterionStatus.passed for c in run.criteria
        )

    outcome = SUCCESS if passed else FAILURE
    summary = f"{condition} -> {outcome}"
    mark_node(run, node.id, NodeStatus.success, summary)
    return HandlerResult(outcome, summary)
