"""Maps node type to handler function."""

from __future__ import annotations

from contracts.models import NodeType, WorkflowNode, RunState
from orchestrator.handlers.criteria_handler import handle_criteria
from orchestrator.handlers.planning_handler import handle_planning
from orchestrator.handlers.execution_handler import handle_execution
from orchestrator.handlers.validator_handler import handle_validator
from orchestrator.handlers.human_gate_handler import handle_human_gate
from orchestrator.handlers.terminal_handler import handle_terminal


class Dispatcher:
    """Routes nodes to their handlers."""

    def __init__(self, repo_path: str = "") -> None:
        self.repo_path = repo_path
        self.handlers = {
            NodeType.agent: self._dispatch_agent,
            NodeType.validator: handle_validator,
            NodeType.human_gate: handle_human_gate,
            NodeType.success: handle_terminal,
            NodeType.stop: handle_terminal,
        }

    def handle(self, node: WorkflowNode, run: RunState) -> dict:
        """Dispatch a node to its handler."""
        handler = self.handlers.get(node.type)
        if handler is None:
            return {"status": "success", "summary": f"Skipped {node.type.value}"}

        if node.type == NodeType.agent:
            return self._dispatch_agent(node, run)
        return handler(node, run, self.repo_path)

    def _dispatch_agent(self, node: WorkflowNode, run: RunState) -> dict:
        """Route agent nodes to the correct handler based on node ID."""
        handlers = {
            "criteria": handle_criteria,
            "planning": handle_planning,
            "execution": handle_execution,
        }
        handler = handlers.get(node.id)
        if handler:
            return handler(node, run, self.repo_path)
        return {"status": "success", "summary": f"Agent {node.id} completed"}
