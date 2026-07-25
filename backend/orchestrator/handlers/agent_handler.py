"""Agent handler — drives the Criteria, Planning, and Execution roles.

Generation lives here (the model is free). Acceptance does NOT — the validator
owns the verdict. This handler only proposes: criteria, a plan, or file edits.

Role is resolved from node.config['role'], falling back to node.id. Each role
maps to a prompt template in the prompts/ directory:
    criteria   -> criteria.txt
    planning   -> planning.txt  (retry_planning.txt when carrying a prior failure)
    execution  -> execution.txt
"""

from __future__ import annotations

import json
import time

from backend.contracts.models import Criterion, NodeStatus, WorkflowNode
from backend.orchestrator.context import FAILURE, SUCCESS, HandlerContext, HandlerResult
from backend.orchestrator.state import EventType, mark_node


def _load_prompt(ctx: HandlerContext, name: str) -> str:
    path = ctx.prompts_dir / f"{name}.txt"
    return path.read_text() if path.exists() else ""


def _resolve_role(node: WorkflowNode) -> str:
    """Resolve the agent role from config or node name/id."""
    role = node.config.get("role")
    if role:
        return role
    # Fallback: infer from node name or id
    name = (node.name or node.id).lower()
    for keyword in ("criteria", "planning", "execution"):
        if keyword in name:
            return keyword
    return node.id


def _build_prompt(ctx: HandlerContext, role: str, template: str) -> str:
    """Compose the template with run context (objective, criteria, feedback)."""
    run = ctx.run
    parts = [template, "\n\n---\n## Task Context\n"]
    parts.append(f"objective: {run.objective}\n")
    if run.criteria:
        crit_json = json.dumps(
            [{"id": c.id, "description": c.description, "command": c.command} for c in run.criteria],
            indent=2,
        )
        parts.append(f"criteria:\n{crit_json}\n")
    parts.append(f"attempt: {run.attempt}\n")
    if role == "planning" and ctx.last_failure:
        parts.append(
            "prior_failure:\n"
            f"  criterion: {ctx.last_failure.get('criterion_id')}\n"
            f"  command: {ctx.last_failure.get('command')}\n"
            f"  evidence: {ctx.last_failure.get('evidence', '')[-1500:]}\n"
        )
    if role == "execution" and ctx.last_plan:
        parts.append(f"plan:\n{json.dumps(ctx.last_plan, indent=2)}\n")
    return "".join(parts)


def _seed_criteria_from_config(ctx: HandlerContext, node: WorkflowNode) -> bool:
    """Hybrid/user-defined criteria supplied directly on the node. Returns True if used."""
    configured = node.config.get("criteria")
    if not configured:
        return False
    ctx.run.criteria = [
        Criterion(
            id=c["id"],
            description=c.get("description", c["id"]),
            command=c["command"],
            expect_exit_code=c.get("expect_exit_code", 0),
        )
        for c in configured
    ]
    return True


def handle_agent(node: WorkflowNode, ctx: HandlerContext) -> HandlerResult:
    run = ctx.run
    role = _resolve_role(node)
    mark_node(run, node.id, NodeStatus.running)

    # --- Criteria role: prefer configured criteria (hybrid default) ---------
    if role == "criteria" and _seed_criteria_from_config(ctx, node):
        summary = f"{len(run.criteria)} success criteria defined"
        mark_node(run, node.id, NodeStatus.success, summary)
        run.emit(node.id, EventType.NODE_FINISHED, {"criteria": len(run.criteria)})
        return HandlerResult(SUCCESS, summary)

    # --- Otherwise invoke the agent runner ----------------------------------
    template_name = "retry_planning" if (role == "planning" and ctx.last_failure) else role
    template = _load_prompt(ctx, template_name)
    prompt = _build_prompt(ctx, role, template)

    run.emit(node.id, EventType.AGENT_INVOKED, {"role": role, "attempt": run.attempt})
    # Fresh logs for this attempt; stream the agent's thinking + tool use live.
    run.clear_logs(node.id)
    run.append_log(node.id, f"$ agent[{role}] attempt {run.attempt}")
    start = time.monotonic()
    result = ctx.runner.run(
        prompt,
        cwd=ctx.repo_path,
        tools=node.config.get("tools"),
        on_log=lambda line: run.append_log(node.id, line),
    )
    elapsed = round(time.monotonic() - start, 3)

    run.cost.model_calls += result.model_calls
    run.cost.seconds += elapsed

    if result.files_changed:
        run.emit(node.id, EventType.FILES_CHANGED, {"files": result.files_changed})

    # If the agent generated criteria (criteria role, no config), parse them.
    if role == "criteria" and not run.criteria:
        _try_parse_generated_criteria(ctx, result)

    if result.status in ("failed", "timeout"):
        summary = f"{role} agent {result.status}"
        mark_node(run, node.id, NodeStatus.failed, summary)
        return HandlerResult(FAILURE, summary, {"status": result.status})

    if role == "planning":
        ctx.last_plan = {"attempt": run.attempt, "transcript": result.transcript_path}

    changed = ", ".join(result.files_changed) if result.files_changed else "no files"
    summary = f"{role}: {changed}"
    mark_node(run, node.id, NodeStatus.success, summary)
    run.emit(node.id, EventType.NODE_FINISHED, {"role": role, "attempt": run.attempt})
    return HandlerResult(SUCCESS, summary, {"files_changed": result.files_changed})


def _try_parse_generated_criteria(ctx: HandlerContext, result) -> None:
    """Best-effort parse of agent-generated criteria JSON from the transcript."""
    try:
        from pathlib import Path
        import re

        text = Path(result.transcript_path).read_text() if result.transcript_path else ""
        if not text:
            return

        # Try multiple patterns to find the criteria JSON
        patterns = [
            r'\{"criteria"\s*:\s*\[',  # {"criteria": [
            r'"criteria"\s*:\s*\[',     # "criteria": [
        ]

        for pattern in patterns:
            match = re.search(pattern, text)
            if not match:
                continue

            # Find the opening { before "criteria"
            start = text.rfind("{", 0, match.start())
            if start == -1:
                continue

            # Find the matching closing }
            depth = 0
            end = -1
            for i in range(start, min(start + 10000, len(text))):
                if text[i] == "{":
                    depth += 1
                elif text[i] == "}":
                    depth -= 1
                    if depth == 0:
                        end = i + 1
                        break

            if end == -1:
                continue

            try:
                data = json.loads(text[start:end])
                criteria_list = data.get("criteria", [])
                if criteria_list:
                    ctx.run.criteria = [
                        Criterion(
                            id=c.get("id", f"c{i+1}"),
                            description=c.get("description", c.get("name", f"Criterion {i+1}")),
                            command=c.get("command", c.get("check", "")),
                            expect_exit_code=c.get("expect_exit_code", 0),
                        )
                        for i, c in enumerate(criteria_list)
                    ]
                    return
            except json.JSONDecodeError:
                continue

    except Exception:
        pass  # Best-effort; configured criteria are the reliable path
    except Exception:
        pass  # generation is best-effort; configured criteria are the reliable path
