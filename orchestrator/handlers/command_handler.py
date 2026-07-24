"""Command handler.

Runs a shell command (build, test, etc.) and returns exit code.
"""

from __future__ import annotations

import subprocess

from contracts.models import WorkflowNode, RunState


def handle(node: WorkflowNode, run: RunState, repo_path: str) -> dict:
    """Run the configured command."""
    command = node.config.get("command", "echo 'no command configured'")
    timeout = node.config.get("timeout", 120)

    try:
        proc = subprocess.run(
            command,
            cwd=repo_path,
            shell=True,
            capture_output=True,
            text=True,
            timeout=timeout,
        )
        exit_code = proc.returncode
        output = (proc.stdout + proc.stderr)[-2000:]
        status = "success" if exit_code == 0 else "failed"

        return {
            "status": status,
            "summary": f"Command exited with code {exit_code}",
            "exit_code": exit_code,
            "output": output,
        }

    except subprocess.TimeoutExpired:
        return {
            "status": "failed",
            "summary": f"Command timed out after {timeout}s",
            "exit_code": -1,
            "output": "",
        }
    except OSError as exc:
        return {
            "status": "failed",
            "summary": f"Failed to run command: {exc}",
            "exit_code": -1,
            "output": "",
        }
