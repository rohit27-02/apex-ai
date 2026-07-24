"""Maps node type to handler function.

The dispatcher is the bridge between the compiled graph and the handlers.
It reads the node type and routes to the correct handler.
"""

from __future__ import annotations

from contracts.models import NodeType, WorkflowNode, RunState


class Dispatcher:
    """Routes nodes to their handlers based on node type and ID."""

    def __init__(self, repo_path: str = "") -> None:
        self.repo_path = repo_path

    def dispatch(self, node: WorkflowNode, run: RunState) -> dict:
        """Dispatch a node to its handler.

        Returns:
            dict with at least: {"status": "success"|"failed", "summary": str}
        """
        if node.type == NodeType.agent:
            return self._handle_agent(node, run)
        elif node.type == NodeType.command:
            return self._handle_command(node, run)
        elif node.type == NodeType.validator:
            from orchestrator.handlers.validator_handler import handle
            return handle(node, run, self.repo_path)
        elif node.type == NodeType.human_gate:
            from orchestrator.handlers.human_gate_handler import handle
            return handle(node, run, self.repo_path)
        elif node.type in (NodeType.success, NodeType.stop):
            from orchestrator.handlers.terminal_handler import handle
            return handle(node, run, self.repo_path)
        else:
            return {"status": "success", "summary": f"Skipped {node.type.value}"}

    def _handle_agent(self, node: WorkflowNode, run: RunState) -> dict:
        """Route agent nodes based on node ID."""
        from orchestrator.handlers.criteria_handler import handle as handle_criteria
        from orchestrator.handlers.planning_handler import handle as handle_planning
        from orchestrator.handlers.execution_handler import handle as handle_execution

        handlers = {
            "criteria": handle_criteria,
            "planning": handle_planning,
            "execution": handle_execution,
        }
        handler = handlers.get(node.id)
        if handler:
            return handler(node, run, self.repo_path)
        return {"status": "success", "summary": f"Agent {node.id} completed"}

    def _handle_command(self, node: WorkflowNode, run: RunState) -> dict:
        """Handle command nodes (shell commands)."""
        from orchestrator.handlers.command_handler import handle
        return handle(node, run, self.repo_path)
