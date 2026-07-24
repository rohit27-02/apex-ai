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
    # Validation failed. Two graph shapes are supported:
    #   a) validator has a failure edge -> retry directly (our default loop)
    #   b) validator has ONLY a success edge into a Decision node -> the
    #      decision routes the failure (Person C's canvas default)
    if node.type == NodeType.validator and result.outcome == FAILURE:
        fail_target = workflow.next_node(node.id, FAILURE)
        if fail_target is None:
            onward = workflow.next_node(node.id, "success")
            if onward is not None:
                return Transition(CONTINUE, onward,
                                  reason="failure delegated to decision node")
        if attempts.has_budget(run):
            return Transition(RETRY, fail_target, reason="validation failed, retrying")
        return Transition(EXHAUSTED, None, reason="retry budget exhausted")

    # Decision routed to its failure path: that IS the retry loop-back.
    if node.type == NodeType.decision and result.outcome == FAILURE:
        fail_target = workflow.next_node(node.id, FAILURE)
        if fail_target is not None and attempts.has_budget(run):
            return Transition(RETRY, fail_target, reason="decision failed, retrying")
        return Transition(EXHAUSTED, None, reason="retry budget exhausted")

    # Human gate is waiting on a real person.
    if result.outcome == AWAITING:
        return Transition(PAUSE, None, reason="awaiting human approval")

    # Terminal nodes end the run.
    if node.type in (NodeType.success, NodeType.stop):
        return Transition(TERMINAL, None, reason="terminal node")

    # Normal edge traversal on the handler's outcome.
    target = workflow.next_node(node.id, result.outcome)
    return Transition(CONTINUE, target, reason=f"edge on {result.outcome}")
