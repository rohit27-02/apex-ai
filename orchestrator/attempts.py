"""Attempt/retry budget management."""

from __future__ import annotations

from contracts.models import NodeType


def check_budget(attempt: int, max_attempts: int, node_type: NodeType) -> bool:
    """Check if we should continue processing.

    Terminal nodes (success/stop) always pass.
    Other nodes fail if attempt exceeds max_attempts.
    """
    if node_type in (NodeType.success, NodeType.stop):
        return True
    return attempt <= max_attempts
