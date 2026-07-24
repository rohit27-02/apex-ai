"""Receipt vocabulary and helpers.

Every state change goes through here so the run console (Person C) has a stable,
documented set of event types to render. These strings match the descriptions in
run_state.schema.json.
"""

from __future__ import annotations

from backend.contracts.models import RunState


class EventType:
    RUN_STARTED = "run_started"
    NODE_STARTED = "node_started"
    NODE_FINISHED = "node_finished"
    AGENT_INVOKED = "agent_invoked"
    COMMAND_EXECUTED = "command_executed"
    FILES_CHANGED = "files_changed"
    VALIDATION_STARTED = "validation_started"
    CRITERION_PASSED = "criterion_passed"
    CRITERION_FAILED = "criterion_failed"
    RETRY_TRIGGERED = "retry_triggered"
    ROLLBACK_STARTED = "rollback_started"
    ROLLBACK_COMPLETED = "rollback_completed"
    POST_ROLLBACK_VERIFICATION_PASSED = "post_rollback_verification_passed"
    POST_ROLLBACK_VERIFICATION_FAILED = "post_rollback_verification_failed"
    HUMAN_GATE_AWAITING = "human_gate_awaiting"
    HUMAN_GATE_APPROVED = "human_gate_approved"
    HUMAN_GATE_REJECTED = "human_gate_rejected"
    RUN_STOPPED_SAFELY = "run_stopped_safely"
    RUN_SUCCEEDED = "run_succeeded"
    CLARIFICATION_REQUESTED = "clarification_requested"


def emit(run: RunState, node_id: str, event_type: str, payload: dict | None = None) -> None:
    """Append a receipt to the run's event log."""
    run.emit(node_id, event_type, payload or {})


# Keep tab/newline/carriage-return; drop other control bytes (ANSI escapes,
# form feeds, NULs) so receipts are clean text for the console and valid JSON.
_KEEP = {0x09, 0x0A, 0x0D}


def sanitize_output(text: str) -> str:
    """Strip control characters from captured command output."""
    if not text:
        return text
    return "".join(ch for ch in text if ord(ch) >= 0x20 or ord(ch) in _KEEP)
