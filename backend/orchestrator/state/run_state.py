"""Runtime helpers for building and mutating RunState.

The RunState model itself lives in contracts. These are orchestrator-side
conveniences for initialising a fresh run and updating node badges.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from backend.contracts.models import NodeState, NodeStatus, RunState, RunStatus, Workflow


def init_run_state(
    workflow: Workflow,
    objective: str,
    max_attempts: int | None = None,
    run_id: str | None = None,
) -> RunState:
    """Build a fresh RunState with every node marked pending."""
    now = datetime.now(timezone.utc)
    node_states = {n.id: NodeState(status=NodeStatus.pending) for n in workflow.nodes}
    return RunState(
        run_id=run_id or str(uuid.uuid4()),
        status=RunStatus.created,
        attempt=0,
        max_attempts=max_attempts or workflow.max_attempts,
        objective=objective,
        started_at=now,
        updated_at=now,
        delivered=False,
        node_states=node_states,
        events=[],
        criteria=[],
    )


def mark_node(
    run: RunState,
    node_id: str,
    status: NodeStatus,
    summary: str | None = None,
) -> None:
    """Update a node's badge state and timestamps."""
    now = datetime.now(timezone.utc)
    node = run.node_states.get(node_id) or NodeState()
    node.status = status
    if status == NodeStatus.running and node.started_at is None:
        node.started_at = now
    if status in (NodeStatus.success, NodeStatus.failed, NodeStatus.skipped):
        node.ended_at = now
    if summary is not None:
        node.result_summary = summary
    run.node_states[node_id] = node
    run.updated_at = now
