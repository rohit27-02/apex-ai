"""Git rollback + green verification."""

from __future__ import annotations

import subprocess


def rollback(repo_path: str) -> bool:
    """Rollback all changes in the repo.

    Returns True if rollback succeeded.
    """
    try:
        # Discard all changes
        subprocess.run(
            ["git", "checkout", "--", "."],
            cwd=repo_path,
            capture_output=True,
            timeout=30,
        )
        # Remove untracked files
        subprocess.run(
            ["git", "clean", "-fd"],
            cwd=repo_path,
            capture_output=True,
            timeout=30,
        )
        return True
    except Exception:
        return False


def verify_green(repo_path: str, test_command: str = "pytest -q") -> bool:
    """Verify the repo is in a green state after rollback.

    Returns True if tests pass.
    """
    try:
        result = subprocess.run(
            test_command,
            cwd=repo_path,
            shell=True,
            capture_output=True,
            timeout=120,
        )
        return result.returncode == 0
    except Exception:
        return False
