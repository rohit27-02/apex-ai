"""Transition logic — given a node and its result, decide what happens next.

Pure decision function: NO side effects. It returns a Transition describing the
action; the engine executes it (rollback, status changes, etc.). This keeps the
'what next' rules in one readable place, each line mapping to a requirement.
"""

from __future__ import annotations

from dataclasses import dataclass

from backend.contracts.models import NodeType, RunState, Workflow, WorkflowNode
from backend.orchestrator import attempts
from backend.orchestrator.context import AWAITING, FAILURE, HandlerResult

# Actions the engine knows how to execute.
CONTINUE = "continue"      # move to next_node
RETRY = "retry"            # bump attempt, loop back to planning
EXHAUSTED = "exhausted"    # budget spent -> rollback + stop
PAUSE = "pause"            # human gate awaiting approval
TERMINAL = "terminal"      # success/stop node reached -> end


@dataclass
class Transition:
    action: str
    next_node: str | None = None
    reason: str = ""


def decide_next(
    workflow: Workflow,
    run: RunState,
    node: WorkflowNode,
    result: HandlerResult,
) -> Transition:
    # Human gate is waiting on a real person.
    if result.outcome == AWAITING:
        return Transition(PAUSE, None, reason="awaiting human approval")

    # Terminal nodes end the run.
    if node.type in (NodeType.success, NodeType.stop):
        return Transition(TERMINAL, None, reason="terminal node")

    # ── Failure handling (generic for all node types) ──
    if result.outcome == FAILURE:
        fail_target = workflow.next_node(node.id, FAILURE)

        # Node has a failure edge → follow it (retry loop-back).
        if fail_target is not None:
            if attempts.has_budget(run):
                return Transition(RETRY, fail_target,
                                  reason=f"{node.type.value} failed, retrying via failure edge")
            return Transition(EXHAUSTED, None, reason="retry budget exhausted")

        # Validator without a failure edge → delegate to success edge (Decision node).
        if node.type == NodeType.validator:
            onward = workflow.next_node(node.id, "success")
            if onward is not None:
                return Transition(CONTINUE, onward,
                                  reason="failure delegated to decision node")

        # Any node without a failure edge but with budget → stop safely.
        # Agent/command failures without a failure edge are not retried.
        return Transition(EXHAUSTED, None,
                          reason=f"{node.type.value} failed, no retry path configured")

    # ── Success / normal traversal ──
    target = workflow.next_node(node.id, result.outcome)
    return Transition(CONTINUE, target, reason=f"edge on {result.outcome}")
