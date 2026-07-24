"""Planning Agent handler."""

from __future__ import annotations

import json
from pathlib import Path

from contracts.models import WorkflowNode, RunState
from orchestrator.handlers._helpers import setup_api_key, get_model, get_repo_tree, get_git_ls_files


def handle(node: WorkflowNode, run: RunState, repo_path: str) -> dict:
    """Create or revise the implementation plan."""
    from runners import AiderRunner

    setup_api_key(node.config)
    model = get_model(node.config)

    # Load prompt template
    prompt_file = node.config.get("prompt_file", "prompts/planning.txt")
    prompt_path = Path(__file__).parent.parent.parent / prompt_file
    prompt_template = prompt_path.read_text()

    # Get repo context
    repo_tree = get_repo_tree(repo_path)
    git_ls_files = get_git_ls_files(repo_path)

    # Build criteria summary
    criteria_summary = json.dumps([
        {"id": c.id, "description": c.description, "command": c.command}
        for c in run.criteria
    ])

    # Get prior failure feedback
    prior_failure = _get_prior_failure(run)

    # Fill prompt
    prompt = prompt_template.replace("{objective}", run.objective)
    prompt = prompt.replace("{criteria}", criteria_summary)
    prompt = prompt.replace("{repo_tree}", repo_tree)
    prompt = prompt.replace("{git_ls_files}", git_ls_files)
    prompt = prompt.replace("{attempt}", str(run.attempt))
    prompt = prompt.replace("{prior_failure}", prior_failure)

    # Run agent
    runner = AiderRunner(model=model)
    result = runner.run(prompt, cwd=repo_path)

    return {
        "status": "success",
        "summary": f"Plan created (attempt {run.attempt})",
        "transcript_path": result.transcript_path,
        "model_calls": result.model_calls,
    }


def _get_prior_failure(run: RunState) -> str:
    """Get failure feedback from the last validation attempt."""
    for event in reversed(run.events):
        if event.type == "criterion_failed":
            p = event.payload
            return f"Failing criterion: {p.get('criterion')}. Evidence: {p.get('stderr', '')}"
    return "null"
