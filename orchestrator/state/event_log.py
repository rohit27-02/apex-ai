"""Event log for run receipts."""

from __future__ import annotations

from datetime import datetime, timezone

from contracts.models import Event


class EventLog:
    """Collects events during a run."""

    def __init__(self) -> None:
        self.events: list[Event] = []

    def emit(self, node_id: str, event_type: str, payload: dict | None = None) -> Event:
        """Append an event."""
        event = Event(
            timestamp=datetime.now(timezone.utc),
            node_id=node_id,
            type=event_type,
            payload=payload or {},
        )
        self.events.append(event)
        return event

    def get_events(self) -> list[Event]:
        return self.events
