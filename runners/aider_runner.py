"""AiderRunner — provider-agnostic agent runner.

Works with ANY LLM provider supported by Aider/litellm.
Just change the model name and API key in .env.

Supported providers (set the matching env var in .env):
  groq/llama-3.3-70b-versatile   -> GROQ_API_KEY
  gemini/gemini-3.5-flash         -> GEMINI_API_KEY
  deepseek/deepseek-chat          -> DEEPSEEK_API_KEY
  openai/gpt-4o                   -> OPENAI_API_KEY
  ollama/llama3.2                 -> (no key needed)

Usage:
    runner = AiderRunner(model="groq/llama-3.3-70b-versatile")
    result = runner.run("Add a comment to main.py", cwd="/path/to/repo")
"""

from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path

from contracts.models import RunnerResult
from runners.key_rotation import get_api_key, mark_exhausted, reset_keys


# Map model prefix -> env var name
PROVIDER_ENV_MAP = {
    "groq/": "GROQ_API_KEY",
    "gemini/": "GEMINI_API_KEY",
    "deepseek/": "DEEPSEEK_API_KEY",
    "openai/": "OPENAI_API_KEY",
    "anthropic/": "ANTHROPIC_API_KEY",
    "openrouter/": "OPENROUTER_API_KEY",
}


class AiderRunner:
    """Runs Aider as a subprocess. Provider-agnostic via litellm."""

    def __init__(
        self,
        model: str = "groq/llama-3.3-70b-versatile",
        timeout: int = 300,
        max_retries: int = 3,
    ) -> None:
        self._model = model
        self._timeout = timeout
        self._max_retries = max_retries

    def run(
        self,
        prompt: str,
        cwd: str,
        tools: list[str] | None = None,
    ) -> RunnerResult:
        reset_keys()
        last_result = None

        for attempt in range(self._max_retries):
            api_key = get_api_key()
            result = self._run_with_key(prompt, cwd, api_key)

            if result.status == "timeout":
                return result

            if self._is_rate_limited(result):
                mark_exhausted(api_key)
                last_result = result
                result = RunnerResult(
                    transcript_path=result.transcript_path,
                    files_changed=result.files_changed,
                    status="failed",
                    model_calls=result.model_calls,
                )
                continue

            return result

        return last_result or RunnerResult(
            transcript_path="",
            files_changed=[],
            status="failed",
            model_calls=0,
        )

    def _run_with_key(
        self,
        prompt: str,
        cwd: str,
        api_key: str,
    ) -> RunnerResult:
        run_dir = Path(cwd) / ".run_output"
        run_dir.mkdir(parents=True, exist_ok=True)

        transcript_path = run_dir / "transcript.jsonl"
        cmd = self._build_command(prompt, cwd)

        # Set the correct env var for this provider
        env = os.environ.copy()
        env_var = self._get_env_var()
        if env_var:
            env[env_var] = api_key

        try:
            result = subprocess.run(
                cmd,
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=self._timeout,
                env=env,
            )
            exit_code = result.returncode
            stdout = result.stdout
            stderr = result.stderr

            events = self._parse_output(stdout, stderr)
            self._write_transcript(transcript_path, events, prompt, exit_code)

            files_changed = self._detect_changed_files(cwd)
            model_calls = self._count_model_calls(events)
            status = "success" if exit_code == 0 else "failed"

            return RunnerResult(
                transcript_path=str(transcript_path),
                files_changed=files_changed,
                status=status,
                model_calls=model_calls,
            )

        except subprocess.TimeoutExpired:
            self._write_timeout_transcript(transcript_path, prompt)
            return RunnerResult(
                transcript_path=str(transcript_path),
                files_changed=[],
                status="timeout",
                model_calls=0,
            )

    def _get_env_var(self) -> str | None:
        """Get the env var name for the current model's provider."""
        for prefix, env_var in PROVIDER_ENV_MAP.items():
            if self._model.startswith(prefix):
                return env_var
        return None

    def _build_command(self, prompt: str, cwd: str) -> list[str]:
        cmd = [
            "aider",
            "--yes-always",
            "--message", prompt,
            "--model", self._model,
            "--no-auto-commits",
            "--no-pretty",
            "--no-git",
            "--no-show-release-notes",
        ]
        # Auto-discover files in the repo
        try:
            result = subprocess.run(
                ["git", "ls-files"],
                cwd=cwd,
                capture_output=True,
                text=True,
                timeout=10,
            )
            if result.returncode == 0 and result.stdout.strip():
                files = result.stdout.strip().split("\n")
                cmd.extend(files)
        except Exception:
            pass
        return cmd

    def _parse_output(self, stdout: str, stderr: str) -> list[dict]:
        ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        events = []
        for line in stdout.strip().split("\n"):
            line = line.strip()
            if line:
                events.append({"ts": ts, "type": "output", "content": line[:4000]})
        if stderr and stderr.strip():
            events.append({"ts": ts, "type": "stderr", "content": stderr[-2000:]})
        return events

    def _write_transcript(self, path: Path, events: list[dict], prompt: str, exit_code: int) -> None:
        ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with open(path, "w") as f:
            f.write(json.dumps({"ts": ts, "type": "run_start", "prompt": prompt[:2000], "model": self._model, "exit_code": exit_code}) + "\n")
            for event in events:
                f.write(json.dumps(event) + "\n")
            f.write(json.dumps({"ts": ts, "type": "run_end", "exit_code": exit_code, "total_events": len(events)}) + "\n")

    def _write_timeout_transcript(self, path: Path, prompt: str) -> None:
        ts = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with open(path, "w") as f:
            f.write(json.dumps({"ts": ts, "type": "timeout", "prompt": prompt[:2000], "model": self._model, "timeout_seconds": self._timeout}) + "\n")

    def _detect_changed_files(self, cwd: str) -> list[str]:
        try:
            result = subprocess.run(["git", "diff", "--name-only", "HEAD"], cwd=cwd, capture_output=True, text=True, timeout=10)
            if result.returncode == 0 and result.stdout.strip():
                return result.stdout.strip().split("\n")
            result2 = subprocess.run(["git", "ls-files", "--others", "--exclude-standard"], cwd=cwd, capture_output=True, text=True, timeout=10)
            if result2.returncode == 0 and result2.stdout.strip():
                return result2.stdout.strip().split("\n")
        except (subprocess.TimeoutExpired, FileNotFoundError):
            pass
        return []

    def _count_model_calls(self, events: list[dict]) -> int:
        output_events = [e for e in events if e.get("type") == "output"]
        return max(1, len(output_events))

    def _is_rate_limited(self, result: RunnerResult) -> bool:
        if not result.transcript_path or not Path(result.transcript_path).exists():
            return False
        try:
            content = Path(result.transcript_path).read_text()
            indicators = ["rate limit", "429", "quota exceeded", "too many requests", "RESOURCE_EXHAUSTED"]
            return any(i.lower() in content.lower() for i in indicators)
        except Exception:
            return False
