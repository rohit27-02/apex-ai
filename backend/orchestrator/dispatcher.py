"""Node type -> handler mapping. The engine's dispatch table.

This is the whole 'graph engine': there is no per-node behaviour, just a fixed
interpreter over a config-defined graph. Adding a node type = adding one entry.
"""

from __future__ import annotations

from backend.contracts.models import NodeType, WorkflowNode
from backend.orchestrator.context import HandlerContext, HandlerResult
from backend.orchestrator.handlers import (
    handle_agent,
    handle_command,
    handle_decision,
    handle_human_gate,
    handle_input,
    handle_terminal,
    handle_validator,
)

NODE_HANDLERS = {
    NodeType.input: handle_input,
    NodeType.agent: handle_agent,
    NodeType.command: handle_command,
    NodeType.validator: handle_validator,
    NodeType.decision: handle_decision,
    NodeType.human_gate: handle_human_gate,
    NodeType.success: handle_terminal,
    NodeType.stop: handle_terminal,
}


def dispatch(node: WorkflowNode, ctx: HandlerContext) -> HandlerResult:
    handler = NODE_HANDLERS.get(node.type)
    if handler is None:
        raise KeyError(f"No handler for node type {node.type!r}")
    return handler(node, ctx)
