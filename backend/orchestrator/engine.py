"""The orchestrator engine — a fixed interpreter over a config-defined graph.

    node = entry
    while node and running:
        result = dispatch(node)          # generation / commands / verdicts
        run.emit(...)                    # receipts
        node = decide_next(node, result) # follow edges in the JSON

Every branch maps to a requirement: separate generation from acceptance, feed
failure back, stay bounded, retreat cleanly, keep receipts. There is no graph
framework here — the graph is user-authored data, and this loop runs it.
"""

from __future__ import annotations

from pathlib import Path

from backend.contracts.models import (
    NodeStatus,
    NodeType,
    RunState,
    RunStatus,
    Workflow,
)
from backend.orchestrator import rollback
from backend.orchestrator.context import HandlerContext
from backend.orchestrator.dispatcher import dispatch
from backend.orchestrator.state import EventType, mark_node
from backend.orchestrator.state.run_state import init_run_state
from backend.orchestrator.transitions import (
    EXHAUSTED,
    PAUSE,
    RETRY,
    TERMINAL,
    decide_next,
)
from backend.runners.base import Runner
from backend.runners.stub_runner import StubRunner

_MAX_STEPS = 200  # hard safety guard against a mis-wired graph looping forever
_DEFAULT_PROMPTS = Path(__file__).resolve().parent.parent / "prompts"


class Orchestrator:
    """Runs one workflow to a terminal state (or a human-gate pause)."""

    def __init__(
        self,
        workflow: Workflow,
        runner: Runner | None = None,
        run: RunState | None = None,
        repo_path: str | None = None,
        objective: str | None = None,
        max_attempts: int | None = None,
        prompts_dir: Path | None = None,
        auto_approve: bool = True,
        green_command: str | None = None,
    ) -> None:
        self.workflow = workflow
        obj = objective or workflow.name
        self.run = run or init_run_state(workflow, obj, max_attempts)
        self.ctx = HandlerContext(
            workflow=workflow,
            run=self.run,
            runner=runner or StubRunner(),
            repo_path=repo_path or workflow.repo_path or ".",
            prompts_dir=prompts_dir or _DEFAULT_PROMPTS,
            auto_approve=auto_approve,
            green_command=green_command,
        )
        self._paused_at: str | None = None

    @property
    def paused_node(self) -> str | None:
        """Node id of the human gate this run is paused at, if any."""
        return self._paused_at

    # -- public API ---------------------------------------------------------

    def run_to_completion(self) -> RunState:
        """Execute from the entry node until terminal or paused. Returns RunState."""
        run = self.run
        run.status = RunStatus.running
        if run.attempt == 0:
            run.attempt = 1
        self.ctx.base_ref = rollback.snapshot(self.ctx.repo_path)
        run.emit(self.workflow.entryNode, EventType.RUN_STARTED,
                 {"objective": run.objective, "max_attempts": run.max_attempts})

        node_id = self.workflow.entryNode
        return self._drive(node_id)

    def resume(self, approved: bool) -> RunState:
        """Continue a run paused at a human gate."""
        run = self.run
        if run.status != RunStatus.awaiting_approval or not self._paused_at:
            return run
        gate_id = self._paused_at
        self._paused_at = None
        run.status = RunStatus.running

        if approved:
            mark_node(run, gate_id, NodeStatus.success, "approved")
            run.emit(gate_id, EventType.HUMAN_GATE_APPROVED, {"auto": False})
            return self._drive(self.workflow.next_node(gate_id, "success"))

        mark_node(run, gate_id, NodeStatus.failed, "rejected")
        run.emit(gate_id, EventType.HUMAN_GATE_REJECTED, {})
        self._stop_safely(gate_id, reason="human gate rejected")
        return run

    # -- core loop ----------------------------------------------------------

    def _drive(self, node_id: str | None) -> RunState:
        run = self.run
        steps = 0
        while node_id is not None and run.status == RunStatus.running:
            steps += 1
            if steps > _MAX_STEPS:
                self._stop_safely(node_id, reason="max steps exceeded")
                break

            node = self.workflow.get_node(node_id)
            run.emit(node.id, EventType.NODE_STARTED, {"attempt": run.attempt})
            result = dispatch(node, self.ctx)

            trans = decide_next(self.workflow, run, node, result)

            if trans.action == RETRY:
                if trans.next_node is None:
                    # Failure with no loop-back edge: retrying is impossible.
                    self._exhaust_and_rollback(node.id)
                    node_id = None
                    continue
                run.attempt += 1
                run.emit(node.id, EventType.RETRY_TRIGGERED, {
                    "attempt": run.attempt,
                    "reason": result.summary,
                })
                self._reset_downstream_nodes()
                node_id = trans.next_node
            elif trans.action == EXHAUSTED:
                self._exhaust_and_rollback(node.id)
                node_id = None
            elif trans.action == PAUSE:
                run.status = RunStatus.awaiting_approval
                self._paused_at = node.id
                node_id = None
            elif trans.action == TERMINAL:
                node_id = None  # terminal handler already set final status
            else:  # CONTINUE
                node_id = trans.next_node
                if node_id is None and run.status == RunStatus.running:
                    # Mis-wired graph: nowhere to go. Never leave a run
                    # stuck in 'running' — stop it honestly.
                    self._stop_safely(
                        node.id,
                        reason=f"no outgoing edge from {node.id!r} on {result.outcome!r}",
                    )

        self._persist()
        return run

    # -- bounded-retreat machinery -----------------------------------------

    def _exhaust_and_rollback(self, node_id: str) -> None:
        """Budget spent: roll back, prove the workspace is green, report undelivered."""
        run = self.run
        run.emit(node_id, EventType.ROLLBACK_STARTED,
                 {"attempt": run.attempt, "base_ref": self.ctx.base_ref})
        did_rollback = rollback.rollback_to_base(self.ctx.repo_path, self.ctx.base_ref)
        run.emit(node_id, EventType.ROLLBACK_COMPLETED, {"performed": did_rollback})

        is_green, evidence = rollback.verify_green(self.ctx.repo_path, self.ctx.green_command)
        if is_green:
            run.emit(node_id, EventType.POST_ROLLBACK_VERIFICATION_PASSED,
                     {"evidence": evidence[-500:]})
        else:
            run.emit(node_id, EventType.POST_ROLLBACK_VERIFICATION_FAILED,
                     {"evidence": evidence[-500:]})

        self._stop_safely(node_id, reason="retry budget exhausted", rolled_back=did_rollback)

    def _stop_safely(self, node_id: str, reason: str, rolled_back: bool = False) -> None:
        run = self.run
        run.status = RunStatus.rolled_back if rolled_back else RunStatus.stopped_safely
        run.delivered = False
        # Light up the stop node if the graph has one.
        stop_node = next((n for n in self.workflow.nodes if n.type == NodeType.stop), None)
        if stop_node:
            mark_node(run, stop_node.id, NodeStatus.success, reason)
        run.emit(stop_node.id if stop_node else node_id,
                 EventType.RUN_STOPPED_SAFELY, {"reason": reason, "delivered": False})

    def _reset_downstream_nodes(self) -> None:
        """On retry, reset execution/validation node badges back to pending."""
        run = self.run
        for n in self.workflow.nodes:
            if (n.type in (NodeType.agent, NodeType.validator, NodeType.decision)
                    and n.id != self.workflow.entryNode):
                # keep criteria node as-is; reset planning/execution/validation
                if n.config.get("role") == "criteria" or n.id == "criteria":
                    continue
                ns = run.node_states.get(n.id)
                if ns and ns.status in (NodeStatus.success, NodeStatus.failed):
                    ns.status = NodeStatus.pending
                    ns.result_summary = None

    def _persist(self) -> None:
        """Best-effort save of the run receipt to runs/<id>/run.json."""
        try:
            out = Path("runs") / self.run.run_id / "run.json"
            self.run.save(out)
        except Exception:
            pass  # persistence is a convenience, not required for correctness
