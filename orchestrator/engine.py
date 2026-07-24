"""Main workflow execution loop.

Compiles the workflow graph at runtime from the API payload,
executes node by node, emits events, and manages retries.
"""

from __future__ import annotations

import time
from datetime import datetime, timezone

from contracts.models import (
    Workflow, RunState, RunStatus, NodeStatus, NodeType,
    EdgeOutcome, Event, NodeState, Criterion,
)
from orchestrator.dispatcher import Dispatcher
from orchestrator.transitions import next_node
from orchestrator.attempts import check_budget


class Engine:
    """Executes a workflow graph compiled at runtime."""

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
        self.attempt = 1
        self.max_attempts = max_attempts

        # Initialize run state
        now = datetime.now(timezone.utc)
        self.run = RunState(
            run_id=str(int(time.time())),
            status=RunStatus.created,
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
        """Execute the compiled workflow graph.

        Flow:
        1. Start at entryNode
        2. Dispatch node to handler
        3. Emit event with result
        4. Follow edge to next node
        5. If validator fails, loop back to planning (retry)
        6. Stop at terminal node or when budget exhausted
        """
        self.run.status = RunStatus.running
        self._emit("engine", "run_started", {"objective": self.objective})

        node_id = self.workflow.entryNode

        while node_id:
            node = self.workflow.get_node(node_id)

            # Check attempt budget before processing
            if not check_budget(self.attempt, self.max_attempts, node.type):
                self.run.status = RunStatus.stopped_safely
                self._emit("engine", "budget_exhausted", {"attempt": self.attempt})
                break

            # Mark node as running
            self.run.node_states[node_id] = NodeState(
                status=NodeStatus.running,
                started_at=datetime.now(timezone.utc),
            )
            self._emit(node_id, "node_started", {"attempt": self.attempt})

            # Dispatch to handler
            result = self.dispatcher.dispatch(node, self.run)

            # Update node state with result
            status = NodeStatus(result.get("status", "success"))
            self.run.node_states[node_id] = NodeState(
                status=status,
                started_at=self.run.node_states[node_id].started_at,
                ended_at=datetime.now(timezone.utc),
                result_summary=result.get("summary", ""),
            )
            self._emit(node_id, "node_finished", result)

            # Handle terminal nodes
            if node.type in (NodeType.success, NodeType.stop):
                self.run.status = (
                    RunStatus.success if node.type == NodeType.success
                    else RunStatus.stopped_safely
                )
                self.run.updated_at = datetime.now(timezone.utc)
                self._emit("engine", "run_finished", {"status": self.run.status.value})
                return self.run

            # Determine outcome and next node
            outcome = self._determine_outcome(node, result)
            next_id = next_node(self.workflow, node_id, outcome)

            # If validator failed, increment attempt
            if outcome == EdgeOutcome.failure:
                self.attempt += 1
                self.run.attempt = self.attempt
                self._emit("engine", "retry_triggered", {
                    "attempt": self.attempt,
                    "reason": result.get("summary", ""),
                })

            node_id = next_id

        # Fallback
        self.run.status = RunStatus.stopped_safely
        self.run.updated_at = datetime.now(timezone.utc)
        return self.run

    def _determine_outcome(self, node, result: dict) -> EdgeOutcome:
        """Determine edge outcome based on node type and handler result."""
        if node.type == NodeType.validator:
            return (
                EdgeOutcome.success if result.get("status") == "success"
                else EdgeOutcome.failure
            )
        return EdgeOutcome.success

    def _emit(self, node_id: str, event_type: str, payload: dict) -> None:
        """Append event to run state."""
        event = Event(
            timestamp=datetime.now(timezone.utc),
            node_id=node_id,
            type=event_type,
            payload=payload,
        )
        self.run.events.append(event)
        self.run.updated_at = datetime.now(timezone.utc)
