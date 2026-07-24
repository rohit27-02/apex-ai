"""Node handlers — one per node type. Each: (node, ctx) -> HandlerResult."""

from backend.orchestrator.handlers.agent_handler import handle_agent
from backend.orchestrator.handlers.command_handler import handle_command
from backend.orchestrator.handlers.decision_handler import handle_decision
from backend.orchestrator.handlers.human_gate_handler import handle_human_gate
from backend.orchestrator.handlers.input_handler import handle_input
from backend.orchestrator.handlers.terminal_handler import handle_terminal
from backend.orchestrator.handlers.validator_handler import handle_validator

__all__ = [
    "handle_agent",
    "handle_command",
    "handle_decision",
    "handle_human_gate",
    "handle_input",
    "handle_terminal",
    "handle_validator",
]
