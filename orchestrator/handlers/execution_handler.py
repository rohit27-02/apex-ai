"""Execution Agent handler."""

from __future__ import annotations

from pathlib import Path

from contracts.models import WorkflowNode, RunState
from orchestrator.handlers._helpers import setup_api_key, get_model, get_repo_tree


def handle(node: WorkflowNode, run: RunState, repo_path: str) -> dict:
    """Execute the plan by modifying files."""
    from runners import AiderRunner

    setup_api_key(node.config)
    model = get_model(node.config)

    # Load prompt template
    prompt_file = node.config.get("prompt_file", "prompts/execution.txt")
    prompt_path = Path(__file__).parent.parent.parent / prompt_file
    prompt_template = prompt_path.read_text()

    # Get repo context
    repo_tree = get_repo_tree(repo_path)

    # Fill prompt
    prompt = prompt_template.replace("{repo_tree}", repo_tree)
    prompt = prompt.replace("{objective}", run.objective)

    # Run agent
    runner = AiderRunner(model=model)
    result = runner.run(prompt, cwd=repo_path)

    return {
        "status": "success" if result.status == "success" else "failed",
        "summary": f"Changed {len(result.files_changed)} files",
        "files_changed": result.files_changed,
        "transcript_path": result.transcript_path,
        "model_calls": result.model_calls,
    }
