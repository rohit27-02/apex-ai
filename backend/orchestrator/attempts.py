"""Attempt / retry budget management. Bounded autonomy lives here.

attempt is 1-indexed and counts planning->execution->validation passes. The
budget is exhausted when attempt >= max_attempts and validation still fails.
"""

from __future__ import annotations

from backend.contracts.models import RunState


def has_budget(run: RunState) -> bool:
    """True if another attempt is allowed after the current one."""
    return run.attempt < run.max_attempts


def remaining(run: RunState) -> int:
    return max(0, run.max_attempts - run.attempt)


def increment(run: RunState) -> int:
    run.attempt += 1
    return run.attempt
