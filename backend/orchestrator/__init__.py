"""Orchestrator — the state machine that runs a workflow graph.

Public entry point:
    from backend.orchestrator import Orchestrator
    result = Orchestrator(workflow, runner=..., objective=...).run_to_completion()
"""

from backend.orchestrator.engine import Orchestrator

__all__ = ["Orchestrator"]
