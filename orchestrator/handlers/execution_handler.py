"""Execution Agent handler.

Loads the execution prompt, fills in context, and calls the runner
to actually modify files in the repo.
"""

from __future__ import annotations

import subprocess
from pathlib import Path

from contracts.models import WorkflowNode, RunState


def handle(node: WorkflowNode, run: RunState, repo_path: str) -> dict:
    """Execute the plan by modifying files."""
    from runners import AiderRunner

    # Load prompt template
    prompt_file = node.config.get("prompt_file", "prompts/execution.txt")
    prompt_path = Path(__file__).parent.parent.parent / prompt_file
    prompt_template = prompt_path.read_text()

    # Get repo context
    repo_tree = _get_repo_tree(repo_path)

    # Fill prompt
    prompt = prompt_template.replace("{repo_tree}", repo_tree)
    prompt = prompt.replace("{objective}", run.objective)

    # Run agent
    model = node.config.get("model", "groq/llama-3.3-70b-versatile")
    runner = AiderRunner(model=model)
    result = runner.run(prompt, cwd=repo_path)

    return {
        "status": "success" if result.status == "success" else "failed",
        "summary": f"Changed {len(result.files_changed)} files",
        "files_changed": result.files_changed,
        "transcript_path": result.transcript_path,
        "model_calls": result.model_calls,
    }


def _get_repo_tree(repo_path: str) -> str:
    try:
        result = subprocess.run(
            ["find", ".", "-type", "f", "-not", "-path", "./.git/*"],
            cwd=repo_path, capture_output=True, text=True, timeout=10,
        )
        return result.stdout[:2000] if result.returncode == 0 else ""
    except Exception:
        return ""
