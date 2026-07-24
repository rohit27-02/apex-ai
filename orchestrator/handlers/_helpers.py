"""Shared helpers for handlers."""

from __future__ import annotations

import os
import subprocess
from pathlib import Path


def setup_api_key(node_config: dict) -> None:
    """Set the API key in environment based on node config."""
    api_key = node_config.get("api_key", "")
    model = node_config.get("model", "")
    if api_key and model:
        provider = model.split("/")[0] if "/" in model else ""
        env_map = {
            "groq": "GROQ_API_KEY",
            "gemini": "GEMINI_API_KEY",
            "deepseek": "DEEPSEEK_API_KEY",
            "openai": "OPENAI_API_KEY",
        }
        env_var = env_map.get(provider, "GROQ_API_KEY")
        os.environ[env_var] = api_key


def get_model(node_config: dict) -> str:
    """Get model from node config."""
    return node_config.get("model", "groq/llama-3.3-70b-versatile")


def get_repo_tree(repo_path: str) -> str:
    """Get directory tree of the repo."""
    try:
        result = subprocess.run(
            ["find", ".", "-type", "f", "-not", "-path", "./.git/*"],
            cwd=repo_path, capture_output=True, text=True, timeout=10,
        )
        return result.stdout[:2000] if result.returncode == 0 else ""
    except Exception:
        return ""


def get_git_ls_files(repo_path: str) -> str:
    """Get list of git-tracked files."""
    try:
        result = subprocess.run(
            ["git", "ls-files"],
            cwd=repo_path, capture_output=True, text=True, timeout=10,
        )
        return result.stdout[:2000] if result.returncode == 0 else ""
    except Exception:
        return ""
