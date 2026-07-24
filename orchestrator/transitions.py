"""Decides next node based on edges and outcome."""

from __future__ import annotations

from contracts.models import Workflow, EdgeOutcome


def next_node(workflow: Workflow, current_id: str, outcome: EdgeOutcome) -> str | None:
    """Follow edges from current_id based on outcome.

    Returns:
        Next node ID, or None if no matching edge (end of graph).
    """
    for edge in workflow.edges:
        if edge.source == current_id and edge.on == outcome:
            return edge.target
    return None
