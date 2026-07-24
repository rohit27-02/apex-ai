"""Execution Agent handler.

Loads the execution prompt, fills in context, and calls the runner
to actually modify files in the repo.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from contracts.models import WorkflowNode, RunState


def handle_execution(node: WorkflowNode, run: RunState, repo_path: str) -> dict:
    """Execute the plan by modifying files."""
    from runners import AiderRunner

    # Load prompt template
    prompt_file = node.config.get("prompt_file", "prompts/execution.txt")
    prompt_path = Path(__file__).parent.parent.parent / prompt_file
    prompt_template = prompt_path.read_text()

    # Get repo context
    repo_tree = _get_repo_tree(repo_path)

    # Get the plan from the last planning event
    plan = _get_last_plan(run)
    files_to_modify = _get_files_to_modify(run)

    # Fill prompt
    prompt = prompt_template.replace("{plan}", plan)
    prompt = prompt.replace("{files_to_modify}", files_to_modify)
    prompt = prompt.replace("{repo_tree}", repo_tree)
    prompt = prompt.replace("{objective}", run.objective)

    # Run agent
    model = node.config.get("model", "groq/llama-3.3-70b-versatile")
    runner = AiderRunner(model=model)
    result = runner.run(prompt, cwd=repo_path)

    return {
        "status": "success" if result.status == "success" else "failed",
        "summary": f"Changed {len(result.files_changed)} files",
        "files_changed": result.files_changed,
        "model_calls": result.model_calls,
    }


def _get_last_plan(run: RunState) -> str:
    """Extract the plan from the last planning event."""
    for event in reversed(run.events):
        if event.node_id == "planning" and event.type == "node_finished":
            return event.payload.get("summary", "No plan available")
    return "No plan available"


def _get_files_to_modify(run: RunState) -> str:
    """Get files to modify from the last planning event."""
    for event in reversed(run.events):
        if event.node_id == "planning" and event.type == "files_changed":
            return json.dumps(event.payload.get("files", []))
    return "[]"


def _get_repo_tree(repo_path: str) -> str:
    try:
        result = subprocess.run(["find", ".", "-type", "f", "-not", "-path", "./.git/*"], cwd=repo_path, capture_output=True, text=True, timeout=10)
        return result.stdout[:2000] if result.returncode == 0 else ""
    except Exception:
        return ""
