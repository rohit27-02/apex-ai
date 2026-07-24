"""Planning Agent handler.

Loads the planning prompt, fills in context (including failure feedback),
and calls the runner.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from contracts.models import WorkflowNode, RunState


def handle_planning(node: WorkflowNode, run: RunState, repo_path: str) -> dict:
    """Create or revise the implementation plan."""
    from runners import AiderRunner

    # Load prompt template
    prompt_file = node.config.get("prompt_file", "prompts/planning.txt")
    prompt_path = Path(__file__).parent.parent.parent / prompt_file
    prompt_template = prompt_path.read_text()

    # Get repo context
    repo_tree = _get_repo_tree(repo_path)
    git_ls_files = _get_git_ls_files(repo_path)

    # Build criteria summary
    criteria_summary = json.dumps([
        {"id": c.id, "description": c.description, "command": c.command}
        for c in run.criteria
    ])

    # Check for prior failure feedback
    prior_failure = _get_prior_failure(run)

    # Fill prompt
    prompt = prompt_template.replace("{objective}", run.objective)
    prompt = prompt.replace("{criteria}", criteria_summary)
    prompt = prompt.replace("{repo_tree}", repo_tree)
    prompt = prompt.replace("{git_ls_files}", git_ls_files)
    prompt = prompt.replace("{attempt}", str(run.attempt))
    prompt = prompt.replace("{prior_failure}", prior_failure)

    # Run agent
    model = node.config.get("model", "groq/llama-3.3-70b-versatile")
    runner = AiderRunner(model=model)
    result = runner.run(prompt, cwd=repo_path)

    return {
        "status": "success",
        "summary": f"Plan created (attempt {run.attempt})",
        "files_changed": result.files_changed,
        "model_calls": result.model_calls,
    }


def _get_prior_failure(run: RunState) -> str:
    """Get failure feedback from the last validation attempt."""
    for event in reversed(run.events):
        if event.type == "criterion_failed":
            payload = event.payload
            return f"Failing criterion: {payload.get('criterion', 'unknown')}. Evidence: {payload.get('stderr', '')}"
    return "null"


def _get_repo_tree(repo_path: str) -> str:
    try:
        result = subprocess.run(["find", ".", "-type", "f", "-not", "-path", "./.git/*"], cwd=repo_path, capture_output=True, text=True, timeout=10)
        return result.stdout[:2000] if result.returncode == 0 else ""
    except Exception:
        return ""


def _get_git_ls_files(repo_path: str) -> str:
    try:
        result = subprocess.run(["git", "ls-files"], cwd=repo_path, capture_output=True, text=True, timeout=10)
        return result.stdout[:2000] if result.returncode == 0 else ""
    except Exception:
        return ""
