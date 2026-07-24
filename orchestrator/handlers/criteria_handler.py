"""Success Criteria Agent handler.

Loads the criteria prompt, fills in context, calls the runner,
and parses the JSON output into run.criteria.
"""

from __future__ import annotations

import json
import subprocess
from pathlib import Path

from contracts.models import WorkflowNode, RunState, Criterion, CriterionStatus


def handle(node: WorkflowNode, run: RunState, repo_path: str) -> dict:
    """Generate success criteria from the objective."""
    from runners import AiderRunner

    # Load prompt template
    prompt_file = node.config.get("prompt_file", "prompts/criteria.txt")
    prompt_path = Path(__file__).parent.parent.parent / prompt_file
    prompt_template = prompt_path.read_text()

    # Get repo context
    repo_tree = _get_repo_tree(repo_path)

    # Fill prompt
    prompt = prompt_template.replace("{objective}", run.objective)
    prompt = prompt.replace("{repo_tree}", repo_tree)
    prompt = prompt.replace("{constraints}", "")

    # Run agent
    model = node.config.get("model", "groq/llama-3.3-70b-versatile")
    runner = AiderRunner(model=model)
    result = runner.run(prompt, cwd=repo_path)

    # Parse criteria from transcript
    criteria = _parse_criteria(result.transcript_path)
    run.criteria = criteria

    return {
        "status": "success",
        "summary": f"{len(criteria)} criteria defined",
        "transcript_path": result.transcript_path,
        "model_calls": result.model_calls,
    }


def _parse_criteria(transcript_path: str) -> list[Criterion]:
    """Extract criteria JSON from the transcript."""
    try:
        content = Path(transcript_path).read_text()
        for line in content.splitlines():
            try:
                obj = json.loads(line)
            except json.JSONDecodeError:
                continue
            if obj.get("type") == "output":
                text = obj.get("content", "")
                if "criteria" in text:
                    try:
                        data = json.loads(text)
                        if "criteria" in data:
                            return [
                                Criterion(
                                    id=c["id"],
                                    description=c["description"],
                                    command=c["command"],
                                    expect_exit_code=c.get("expect_exit_code", 0),
                                    status=CriterionStatus.pending,
                                )
                                for c in data["criteria"]
                            ]
                    except json.JSONDecodeError:
                        pass
    except Exception:
        pass

    # Fallback
    return [
        Criterion(id="tests", description="All tests pass", command="pytest -q", expect_exit_code=0, status=CriterionStatus.pending),
        Criterion(id="lint", description="Lint passes", command="ruff check .", expect_exit_code=0, status=CriterionStatus.pending),
    ]


def _get_repo_tree(repo_path: str) -> str:
    try:
        result = subprocess.run(
            ["find", ".", "-type", "f", "-not", "-path", "./.git/*"],
            cwd=repo_path, capture_output=True, text=True, timeout=10,
        )
        return result.stdout[:2000] if result.returncode == 0 else ""
    except Exception:
        return ""
