"""Human Gate handler.

Pauses for approval or auto-approves if configured.
"""

from __future__ import annotations

from contracts.models import WorkflowNode, RunState, RunStatus


def handle(node: WorkflowNode, run: RunState, repo_path: str) -> dict:
    """Handle human approval gate."""
    auto_approve = node.config.get("auto_approve", False)

    if auto_approve:
        return {
            "status": "success",
            "summary": "Auto-approved",
        }

    # Set run to awaiting approval
    run.status = RunStatus.awaiting_approval
    return {
        "status": "success",
        "summary": "Awaiting human approval",
    }
