"""Human Gate handler.

Pauses for approval or auto-approves if configured.
"""

from __future__ import annotations

from contracts.models import WorkflowNode, RunState


def handle_human_gate(node: WorkflowNode, run: RunState, repo_path: str) -> dict:
    """Handle human approval gate."""
    auto_approve = node.config.get("auto_approve", False)

    if auto_approve:
        return {
            "status": "success",
            "summary": "Auto-approved",
        }

    # In real implementation, this would set run.status = "awaiting_approval"
    # and wait for a POST /runs/{id}/approve endpoint
    return {
        "status": "success",
        "summary": "Awaiting approval (simulated)",
    }
