"""Main workflow execution loop.

The engine drives the workflow: reads the current node, dispatches to handler,
follows edges to next node, manages attempts and retries.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone
from pathlib import Path

from contracts.models import (
    Workflow, RunState, RunStatus, NodeStatus, NodeType,
    EdgeOutcome, Event, NodeState,
)
from orchestrator.dispatcher import Dispatcher
from orchestrator.state.event_log import EventLog


class Engine:
    """Executes a workflow against a repository."""

    def __init__(
        self,
        workflow: Workflow,
        objective: str,
        max_attempts: int = 3,
        repo_path: str = "",
    ) -> None:
        self.workflow = workflow
        self.objective = objective
        self.repo_path = repo_path
        self.dispatcher = Dispatcher(repo_path=repo_path)
        self.event_log = EventLog()

        now = datetime.now(timezone.utc)
        self.run = RunState(
            run_id=str(int(time.time())),
            status=RunStatus.running,
            attempt=1,
            max_attempts=max_attempts,
            objective=objective,
            started_at=now,
            updated_at=now,
            delivered=False,
            node_states={},
            events=[],
            criteria=[],
        )

    def run_workflow(self) -> RunState:
        """Execute the full workflow loop."""
        node_id = self.workflow.entryNode

        while node_id and self.run.attempt <= self.run.max_attempts:
            node = self.workflow.get_node(node_id)

            # Mark node as running
            self.run.node_states[node_id] = NodeState(
                status=NodeStatus.running,
                started_at=datetime.now(timezone.utc),
            )
            self._emit(node_id, "node_started", {"attempt": self.run.attempt})

            # Dispatch to handler
            result = self.dispatcher.handle(node, self.run)

            # Update node state
            self.run.node_states[node_id] = NodeState(
                status=NodeStatus(result.get("status", "success")),
                started_at=self.run.node_states[node_id].started_at,
                ended_at=datetime.now(timezone.utc),
                result_summary=result.get("summary", ""),
            )
            self._emit(node_id, "node_finished", result)

            # Handle terminal nodes
            if node.type in (NodeType.success, NodeType.stop):
                self.run.status = RunStatus.success if node.type == NodeType.success else RunStatus.stopped_safely
                self.run.updated_at = datetime.now(timezone.utc)
                return self.run

            # Determine next node
            outcome = self._get_outcome(node, result)
            node_id = self.workflow.next_node(node_id, outcome)

            # Handle retry loop
            if outcome == EdgeOutcome.failure and node.type == NodeType.validator:
                self.run.attempt += 1
                if self.run.attempt > self.run.max_attempts:
                    self.run.status = RunStatus.stopped_safely
                    self.run.updated_at = datetime.now(timezone.utc)
                    return self.run

        # Should not reach here, but safety
        self.run.status = RunStatus.stopped_safely
        self.run.updated_at = datetime.now(timezone.utc)
        return self.run

    def _get_outcome(self, node, result: dict) -> EdgeOutcome:
        """Determine the edge outcome based on node type and result."""
        if node.type == NodeType.validator:
            if result.get("status") == "success":
                return EdgeOutcome.success
            return EdgeOutcome.failure
        return EdgeOutcome.success

    def _emit(self, node_id: str, event_type: str, payload: dict) -> None:
        """Append an event to the run state."""
        event = Event(
            timestamp=datetime.now(timezone.utc),
            node_id=node_id,
            type=event_type,
            payload=payload,
        )
        self.run.events.append(event)
        self.run.updated_at = datetime.now(timezone.utc)
