"""API key rotation — provider agnostic.

Loads ALL API keys from .env and rotates through them.
Works with any provider: Groq, Gemini, DeepSeek, OpenAI, etc.

Usage:
    from runners.key_rotation import get_api_key, mark_exhausted

    key = get_api_key()
    # ... use key ...
    if rate_limited:
        mark_exhausted(key)
        key = get_api_key()  # gets next key
"""

from __future__ import annotations

import itertools
import os
from pathlib import Path


_keys: list[str] = []
_cycle: itertools.cycle | None = None
_exhausted: set[str] = set()


def _load_keys() -> list[str]:
    """Load all API keys from .env file.

    Recognizes any env var ending with _API_KEY or _API_KEY_*.
    Examples: GROQ_API_KEY, GEMINI_API_KEY_1, OPENAI_API_KEY, DEEPSEEK_API_KEY
    """
    global _keys
    if _keys:
        return _keys

    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip()
                if v and "_API_KEY" in k:
                    os.environ[k] = v

    _keys = [v for k, v in os.environ.items() if "_API_KEY" in k and v]

    if not _keys:
        raise RuntimeError("No API keys found in .env")

    return _keys


def get_api_key() -> str:
    """Get the next available API key (round-robin, skipping exhausted)."""
    global _cycle
    keys = _load_keys()

    available = [k for k in keys if k not in _exhausted]

    if not available:
        _exhausted.clear()
        available = keys

    if _cycle is None:
        _cycle = itertools.cycle(available)

    for _ in range(len(available)):
        key = next(_cycle)
        if key not in _exhausted:
            return key

    return available[0]


def mark_exhausted(key: str) -> None:
    """Mark a key as rate-limited."""
    _exhausted.add(key)


def reset_keys() -> None:
    """Reset all exhausted keys."""
    global _cycle
    _exhausted.clear()
    _cycle = None


def available_count() -> int:
    """Number of non-exhausted keys remaining."""
    keys = _load_keys()
    return len([k for k in keys if k not in _exhausted])
