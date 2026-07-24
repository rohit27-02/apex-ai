"""Rollback + green verification. The 'retreat cleanly' half of bounded autonomy.

When the retry budget is exhausted, the engine must leave the workspace in a
green state and report the work honestly as undelivered. We:
  1. snapshot the base git ref BEFORE any changes,
  2. hard-reset + clean back to that ref on exhaustion,
  3. re-run a baseline check and PROVE the workspace is green — logged as a receipt.

Degrades gracefully when the target isn't a git repo (StubRunner demos): rollback
is a no-op and verification runs the baseline command if one is configured.
"""

from __future__ import annotations

import subprocess
from pathlib import Path


def is_git_repo(repo_path: str) -> bool:
    if not repo_path or not Path(repo_path).exists():
        return False
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "--is-inside-work-tree"],
            cwd=repo_path, capture_output=True, text=True, timeout=10,
        )
        return proc.returncode == 0 and proc.stdout.strip() == "true"
    except Exception:
        return False


def snapshot(repo_path: str) -> str | None:
    """Capture the current HEAD so we can return to it later."""
    if not is_git_repo(repo_path):
        return None
    try:
        proc = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=repo_path, capture_output=True, text=True, timeout=10,
        )
        return proc.stdout.strip() if proc.returncode == 0 else None
    except Exception:
        return None


def rollback_to_base(repo_path: str, base_ref: str | None) -> bool:
    """Discard all working changes and return to base_ref. True if performed."""
    if not base_ref or not is_git_repo(repo_path):
        return False
    try:
        subprocess.run(["git", "reset", "--hard", base_ref],
                       cwd=repo_path, capture_output=True, text=True, timeout=30)
        subprocess.run(["git", "clean", "-fd"],
                       cwd=repo_path, capture_output=True, text=True, timeout=30)
        return True
    except Exception:
        return False


def verify_green(repo_path: str, green_command: str | None) -> tuple[bool, str]:
    """Re-run the baseline check post-rollback. Returns (is_green, evidence).

    green_command is the repo's own baseline suite (e.g. 'pytest -q'), NOT the
    feature criteria — the point is proving the workspace isn't broken, not that
    the abandoned feature works. If no command is configured, we report skipped.
    """
    if not green_command:
        return True, "no baseline command configured; skipped"
    try:
        proc = subprocess.run(
            green_command, cwd=repo_path, shell=True,
            capture_output=True, text=True, timeout=180,
        )
        output = ((proc.stdout or "") + (proc.stderr or ""))[-2000:]
        return proc.returncode == 0, output
    except subprocess.TimeoutExpired:
        return False, "baseline check timed out"
    except Exception as exc:
        return False, f"baseline check error: {exc}"
