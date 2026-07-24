"""Terminal handler (success / stop)."""

from __future__ import annotations

from contracts.models import WorkflowNode, RunState


def handle(node: WorkflowNode, run: RunState, repo_path: str) -> dict:
    """Handle terminal nodes."""
    return {
        "status": "success",
        "summary": f"Terminal: {node.type.value}",
    }
