"""OpenAI SDK runner — provider-agnostic agent runner using the OpenAI API.

Works with ANY OpenAI-compatible provider by setting the base URL:
  groq/llama-3.3-70b-versatile   -> https://api.groq.com/openai/v1
  gemini/gemini-2.0-flash         -> https://generativelanguage.googleapis.com/v1beta/openai
  deepseek/deepseek-chat          -> https://api.deepseek.com/v1
  openai/gpt-4o                   -> https://api.openai.com/v1
  openrouter/meta-llama/...       -> https://openrouter.ai/api/v1

The model name is sent as-is to the provider's chat completions endpoint.
Set the matching env var in .env for the API key.

Usage:
    runner = OpenAIRunner(model="groq/llama-3.3-70b-versatile")
    result = runner.run("Add a comment to main.py", cwd="/path/to/repo")
"""

from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path

from backend.contracts.models import RunnerResult
from backend.runners.base import LogSink
from backend.runners.key_rotation import get_api_key, mark_exhausted, reset_keys

# Map model prefix -> (env var name, base URL)
PROVIDER_MAP: dict[str, tuple[str, str]] = {
    "groq/": ("GROQ_API_KEY", "https://api.groq.com/openai/v1"),
    "gemini/": ("GEMINI_API_KEY", "https://generativelanguage.googleapis.com/v1beta/openai"),
    "deepseek/": ("DEEPSEEK_API_KEY", "https://api.deepseek.com/v1"),
    "openai/": ("OPENAI_API_KEY", "https://api.openai.com/v1"),
    "anthropic/": ("ANTHROPIC_API_KEY", "https://api.anthropic.com/v1"),
    "openrouter/": ("OPENROUTER_API_KEY", "https://openrouter.ai/api/v1"),
}

# ReAct tools available to the agent — full file system access
AGENT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the contents of a file.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Path to the file (relative or absolute)"}
                },
                "required": ["filepath"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Create or overwrite a file. Parent directories are created automatically.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Path to the file"},
                    "content": {"type": "string", "description": "The full file content"},
                },
                "required": ["filepath", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "edit_file",
            "description": "Replace a section of a file by finding exact old text and replacing with new text.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Path to the file"},
                    "old_text": {"type": "string", "description": "Exact text to find and replace"},
                    "new_text": {"type": "string", "description": "Replacement text"},
                },
                "required": ["filepath", "old_text", "new_text"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "delete_file",
            "description": "Delete a file or empty directory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Path to delete"},
                },
                "required": ["filepath"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_directory",
            "description": "Create a directory (and any missing parents).",
            "parameters": {
                "type": "object",
                "properties": {
                    "dirpath": {"type": "string", "description": "Directory path to create"},
                },
                "required": ["dirpath"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "move_file",
            "description": "Move or rename a file or directory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "source": {"type": "string", "description": "Current path"},
                    "destination": {"type": "string", "description": "New path"},
                },
                "required": ["source", "destination"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "list_files",
            "description": "List files and directories at a path. Shows tree structure.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {"type": "string", "description": "Directory path (default: working directory)"},
                    "depth": {"type": "integer", "description": "Max depth to show (default: 3)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search",
            "description": "Search for a pattern in files using grep/ripgrep.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Text or regex pattern to search for"},
                    "path": {"type": "string", "description": "Directory to search in (default: working directory)"},
                    "file_pattern": {"type": "string", "description": "File glob pattern, e.g. '*.py' or '*.ts'"},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_command",
            "description": "Execute any shell command. Use for git, npm, pip, tests, builds, etc.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {"type": "string", "description": "Shell command to run"},
                    "cwd": {"type": "string", "description": "Working directory (default: project root)"},
                },
                "required": ["command"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_files",
            "description": "Find files by name pattern.",
            "parameters": {
                "type": "object",
                "properties": {
                    "pattern": {"type": "string", "description": "Glob pattern, e.g. '*.py', '**/*.tsx', 'src/**'"},
                    "path": {"type": "string", "description": "Directory to search in (default: working directory)"},
                },
                "required": ["pattern"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_status",
            "description": "Show git status — modified, added, deleted files.",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_diff",
            "description": "Show git diff for changed files.",
            "parameters": {
                "type": "object",
                "properties": {
                    "filepath": {"type": "string", "description": "Specific file to diff (default: all changes)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_log",
            "description": "Show recent git commit history.",
            "parameters": {
                "type": "object",
                "properties": {
                    "count": {"type": "integer", "description": "Number of commits to show (default: 10)"},
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_commit",
            "description": "Stage all changes and create a git commit.",
            "parameters": {
                "type": "object",
                "properties": {
                    "message": {"type": "string", "description": "Commit message"},
                },
                "required": ["message"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "git_branch",
            "description": "List branches or create a new branch.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Branch name to create and switch to (omit to list branches)"},
                },
            },
        },
    },
]

SYSTEM_PROMPT = (
    "You are an autonomous AI coding agent with FULL file system access. "
    "You operate in a Reason+Act loop: think step-by-step, use tools to "
    "read/create/edit/delete files and run commands, then verify your work.\n\n"
    "## Capabilities\n"
    "- Read, write, edit, delete, move, and create files and directories\n"
    "- Run any shell command (git, npm, pip, python, pytest, etc.)\n"
    "- Search codebases by content or filename\n"
    "- Create entire projects from scratch\n"
    "- Modify existing codebases\n\n"
    "## Rules\n"
    "- Always check existing files before overwriting\n"
    "- Create parent directories when writing new files\n"
    "- Verify your changes by reading the file back or running tests\n"
    "- When creating a new project, set up proper structure (src/, tests/, config files)\n"
    "- If a path is mentioned in the objective, use that path. Otherwise create in the working directory.\n"
)


def _resolve_provider(model: str) -> tuple[str, str]:
    """Return (api_key_env_var, base_url) for the given model string."""
    for prefix, (env_var, base_url) in PROVIDER_MAP.items():
        if model.startswith(prefix):
            return env_var, base_url
    return "OPENAI_API_KEY", "https://api.openai.com/v1"


def _find_or_create_project(objective: str, base_dir: str) -> str:
    """Extract a path from the objective, verify it exists, or create a new project.

    Returns the absolute path to work in.
    """
    import re

    # Try to extract a path from the objective
    # Patterns: "in /path/to/dir", "at C:\path", "path: ./mydir", "folder: myproject"
    path_patterns = [
        r'(?:in|at|into|under|inside)\s+([A-Za-z]:\\[^\s,;]+)',  # Windows absolute
        r'(?:in|at|into|under|inside)\s+(\/[^\s,;]+)',            # Unix absolute
        r'(?:in|at|into|under|inside)\s+([./][^\s,;]+)',          # Relative with ./
        r'path:\s*([^\s,;]+)',                                     # Explicit path:
        r'folder:\s*([^\s,;]+)',                                   # Explicit folder:
        r'directory:\s*([^\s,;]+)',                                # Explicit directory:
        r'project:\s*([^\s,;]+)',                                  # Explicit project:
    ]

    for pattern in path_patterns:
        match = re.search(pattern, objective, re.IGNORECASE)
        if match:
            raw_path = match.group(1).strip()
            abs_path = os.path.abspath(raw_path)
            if os.path.exists(abs_path):
                return abs_path
            # Path doesn't exist — create it
            os.makedirs(abs_path, exist_ok=True)
            return abs_path

    # No path specified — use base_dir as-is
    return base_dir


def _repo_tree(cwd: str, max_files: int = 200) -> str:
    """Get a quick directory listing of the repo."""
    import shutil
    git = shutil.which("git")
    if git:
        try:
            result = subprocess.run(
                [git, "ls-files"],
                cwd=work_dir, capture_output=True, text=True, timeout=10,
            )
            if result.returncode == 0 and result.stdout.strip():
                files = result.stdout.strip().split("\n")[:max_files]
                return "\n".join(files)
        except Exception:
            pass
    # Fallback: directory listing
    try:
        result = subprocess.run(
            "dir /s /b",
            cwd=work_dir, capture_output=True, text=True, shell=True, timeout=10,
        )
        if result.returncode == 0:
            lines = result.stdout.strip().split("\n")[:max_files]
            return "\n".join(l.replace(cwd, "").lstrip("\\/") for l in lines)
    except Exception:
        pass
    return "(unable to list files)"


def _detect_changed_files(cwd: str) -> list[str]:
    """Detect files changed since HEAD."""
    import shutil
    git = shutil.which("git")
    if not git:
        return []
    try:
        result = subprocess.run(
            [git, "diff", "--name-only", "HEAD"],
            cwd=work_dir, capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0 and result.stdout.strip():
            return result.stdout.strip().split("\n")
        result2 = subprocess.run(
            [git, "ls-files", "--others", "--exclude-standard"],
            cwd=work_dir, capture_output=True, text=True, timeout=10,
        )
        if result2.returncode == 0 and result2.stdout.strip():
            return result2.stdout.strip().split("\n")
    except (subprocess.TimeoutExpired, FileNotFoundError):
        pass
    return []


class OpenAIRunner:
    """Runs an LLM agent via the OpenAI-compatible chat completions API."""

    def __init__(
        self,
        model: str = "groq/llama-3.3-70b-versatile",
        timeout: int = 300,
        max_turns: int = 20,
        max_retries: int = 3,
        api_key: str | None = None,
        base_url: str | None = None,
    ) -> None:
        self._model = model
        self._timeout = timeout
        self._max_turns = max_turns
        self._max_retries = max_retries
        self._api_key = api_key or None
        self._base_url = base_url or None

    def run(
        self,
        prompt: str,
        cwd: str,
        tools: list[str] | None = None,
        on_log: LogSink | None = None,
    ) -> RunnerResult:
        if self._api_key:
            return self._run_with_key(prompt, cwd, self._api_key, on_log)

        reset_keys()
        last_result = None

        for _ in range(self._max_retries):
            api_key = get_api_key()
            result = self._run_with_key(prompt, cwd, api_key, on_log)

            if result.status == "timeout":
                return result

            if self._is_rate_limited(result):
                mark_exhausted(api_key)
                last_result = result
                if on_log:
                    on_log("[rate limited — rotating to next key]")
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
        on_log: LogSink | None = None,
    ) -> RunnerResult:
        from openai import OpenAI

        env_var, default_base_url = _resolve_provider(self._model)
        base_url = self._base_url or default_base_url
        client = OpenAI(api_key=api_key, base_url=base_url)

        # Resolve working directory from the objective
        work_dir = _find_or_create_project(prompt, cwd)
        log_fn = on_log or (lambda _: None)
        log_fn(f"$ working directory: {work_dir}")

        run_dir = Path(work_dir) / ".run_output"
        run_dir.mkdir(parents=True, exist_ok=True)
        transcript_path = run_dir / "transcript.jsonl"

        # Build context: repo tree + the user's prompt
        tree = _repo_tree(work_dir)
        system_msg = (
            f"{SYSTEM_PROMPT}\n\n"
            f"## Working directory\n{work_dir}\n\n"
            f"## Files in this directory\n{tree}"
        )

        messages: list[dict] = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": prompt},
        ]
        transcript: list[dict] = [
            {"role": "system", "content": system_msg},
            {"role": "user", "content": prompt},
        ]

        files_changed: set[str] = set()
        model_calls = 0
        status = "failed"
        start_time = time.monotonic()

        def log(msg: str) -> None:
            if on_log:
                on_log(msg)

        log(f"$ agent[{self._model}] objective: {prompt[:120]}")

        # Strip provider prefix for the API call (e.g. "groq/llama-3.3-70b-versatile" -> "llama-3.3-70b-versatile")
        api_model = self._model
        if "/" in api_model:
            api_model = api_model.split("/", 1)[1]
        if not api_model:
            log("[error: no model configured — set a model in Settings]")
            return RunnerResult(
                transcript_path=str(transcript_path),
                files_changed=[],
                status="failed",
                model_calls=0,
            )

        for turn in range(self._max_turns):
            # Enforce timeout
            if time.monotonic() - start_time > self._timeout:
                log(f"[timed out after {self._timeout}s]")
                status = "timeout"
                break

            log(f"--- turn {turn + 1}/{self._max_turns} ---")

            try:
                response = client.chat.completions.create(
                    model=api_model,
                    messages=messages,
                    tools=AGENT_TOOLS,
                    tool_choice="auto",
                )
            except Exception as exc:
                err = str(exc)
                log(f"[API error: {err[:500]}]")
                transcript.append({"role": "error", "content": err})
                status = "failed"
                break

            model_calls += 1
            choice = response.choices[0]
            msg = choice.message

            # Record the assistant message
            msg_dict = msg.model_dump(exclude_none=True)
            messages.append(msg_dict)
            transcript.append(msg_dict)

            if msg.content:
                log(msg.content[:500])

            # If no tool calls, the agent is done
            if not msg.tool_calls:
                log("agent completed — no more tool calls")
                status = "success"
                break

            # Execute each tool call
            for tc in msg.tool_calls:
                fn = tc.function.name
                try:
                    args = json.loads(tc.function.arguments)
                except Exception:
                    args = {}

                log(f"  {fn}({json.dumps(args, ensure_ascii=False)[:200]})")
                result_text = self._execute_tool(fn, args, work_dir, files_changed)
                log(f"  -> {result_text[:200]}")

                tool_msg = {
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "name": fn,
                    "content": result_text,
                }
                messages.append(tool_msg)
                transcript.append(tool_msg)

        # Persist transcript
        try:
            with open(transcript_path, "w", encoding="utf-8") as f:
                for entry in transcript:
                    f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception:
            pass

        detected = _detect_changed_files(cwd)
        all_changed = sorted(files_changed | set(detected))

        log(f"files changed: {', '.join(all_changed) if all_changed else 'none'}")

        return RunnerResult(
            transcript_path=str(transcript_path),
            files_changed=all_changed,
            status=status,
            model_calls=model_calls,
        )

    def _execute_tool(
        self,
        name: str,
        args: dict,
        cwd: str,
        files_changed: set[str],
    ) -> str:
        """Execute a tool call and return the result text."""
        def resolve(fp: str) -> Path:
            """Resolve a path — absolute as-is, relative to cwd."""
            p = Path(fp)
            if p.is_absolute():
                return p
            return Path(cwd) / fp

        try:
            if name == "read_file":
                fp = args.get("filepath", "")
                abs_fp = resolve(fp)
                if not abs_fp.exists():
                    return f"Error: file not found: {fp}"
                if abs_fp.is_dir():
                    return f"Error: {fp} is a directory, not a file"
                return abs_fp.read_text(encoding="utf-8")

            elif name == "write_file":
                fp = args.get("filepath", "")
                content = args.get("content", "")
                abs_fp = resolve(fp)
                abs_fp.parent.mkdir(parents=True, exist_ok=True)
                abs_fp.write_text(content, encoding="utf-8")
                files_changed.add(str(abs_fp.relative_to(cwd)) if abs_fp.is_relative_to(cwd) else str(abs_fp))
                return f"Written {len(content)} bytes to {fp}"

            elif name == "edit_file":
                fp = args.get("filepath", "")
                old_text = args.get("old_text", "")
                new_text = args.get("new_text", "")
                abs_fp = resolve(fp)
                if not abs_fp.exists():
                    return f"Error: file not found: {fp}"
                content = abs_fp.read_text(encoding="utf-8")
                if old_text not in content:
                    return f"Error: old_text not found in {fp}"
                content = content.replace(old_text, new_text, 1)
                abs_fp.write_text(content, encoding="utf-8")
                files_changed.add(str(abs_fp.relative_to(cwd)) if abs_fp.is_relative_to(cwd) else str(abs_fp))
                return f"Edited {fp}"

            elif name == "delete_file":
                fp = args.get("filepath", "")
                abs_fp = resolve(fp)
                if not abs_fp.exists():
                    return f"Error: not found: {fp}"
                if abs_fp.is_dir():
                    import shutil
                    shutil.rmtree(abs_fp)
                    return f"Deleted directory: {fp}"
                abs_fp.unlink()
                files_changed.add(str(abs_fp.relative_to(cwd)) if abs_fp.is_relative_to(cwd) else str(abs_fp))
                return f"Deleted: {fp}"

            elif name == "create_directory":
                dp = args.get("dirpath", "")
                abs_dp = resolve(dp)
                abs_dp.mkdir(parents=True, exist_ok=True)
                return f"Created directory: {dp}"

            elif name == "move_file":
                src = args.get("source", "")
                dst = args.get("destination", "")
                abs_src = resolve(src)
                abs_dst = resolve(dst)
                if not abs_src.exists():
                    return f"Error: source not found: {src}"
                abs_dst.parent.mkdir(parents=True, exist_ok=True)
                abs_src.rename(abs_dst)
                files_changed.add(str(abs_src.relative_to(cwd)) if abs_src.is_relative_to(cwd) else str(abs_src))
                return f"Moved {src} -> {dst}"

            elif name == "run_command":
                cmd = args.get("command", "")
                cmd_cwd = args.get("cwd")
                run_cwd = resolve(cmd_cwd) if cmd_cwd else Path(cwd)
                try:
                    proc = subprocess.run(
                        cmd, shell=True, cwd=str(run_cwd),
                        capture_output=True, text=True, timeout=60,
                    )
                    output = (proc.stdout + proc.stderr)[-3000:]
                    return f"exit {proc.returncode}\n{output}"
                except FileNotFoundError:
                    return f"Error: command not found: {cmd}"
                except subprocess.TimeoutExpired:
                    return "Error: command timed out after 60s"

            elif name == "list_files":
                path = args.get("path", ".")
                depth = args.get("depth", 3)
                abs_path = resolve(path)
                if not abs_path.exists():
                    return f"Error: path not found: {path}"
                if abs_path.is_file():
                    return str(abs_path.name)
                # Try git ls-files first
                import shutil
                git = shutil.which("git")
                if git:
                    result = subprocess.run(
                        [git, "ls-files", "--", str(abs_path)],
                        cwd=cwd, capture_output=True, text=True, timeout=10,
                    )
                    if result.returncode == 0 and result.stdout.strip():
                        return result.stdout.strip()
                # Fallback: directory tree
                lines = []
                for item in sorted(abs_path.iterdir())[:100]:
                    rel = item.relative_to(abs_path)
                    prefix = "  " if item.is_file() else "📁 "
                    lines.append(f"{prefix}{rel}")
                    if len(lines) >= 50:
                        lines.append("  ... (truncated)")
                        break
                return "\n".join(lines) if lines else "(empty directory)"

            elif name == "find_files":
                pattern = args.get("pattern", "*")
                search_path = args.get("path", ".")
                abs_search = resolve(search_path)
                import glob as glob_mod
                matches = sorted(glob_mod.glob(str(abs_search / pattern), recursive=True))[:50]
                if not matches:
                    # Try recursive
                    matches = sorted(glob_mod.glob(str(abs_search / "**" / pattern), recursive=True))[:50]
                rel_matches = [str(Path(m).relative_to(cwd)) for m in matches]
                return "\n".join(rel_matches) if rel_matches else "(no matches)"

            elif name == "search":
                pattern = args.get("pattern", "")
                search_path = args.get("path", ".")
                file_pattern = args.get("file_pattern", "")
                abs_search = resolve(search_path)
                import shutil
                # Try ripgrep first
                rg = shutil.which("rg")
                if rg:
                    cmd = [rg, "-n", "--max-count", "50", pattern, str(abs_search)]
                    if file_pattern:
                        cmd.extend(["-g", file_pattern])
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                else:
                    # Fallback to grep
                    cmd = ["grep", "-rn", pattern, str(abs_search)]
                    if file_pattern:
                        cmd.extend(["--include", file_pattern])
                    result = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
                output = (result.stdout or "")[:5000]
                return output.strip() or "(no matches)"

            elif name == "git_status":
                result = subprocess.run(
                    ["git", "status", "--short"], cwd=cwd, capture_output=True, text=True, timeout=10,
                )
                return result.stdout.strip() or "(clean working tree)"

            elif name == "git_diff":
                fp = args.get("filepath", "")
                if fp:
                    result = subprocess.run(
                        ["git", "diff", "--", fp], cwd=cwd, capture_output=True, text=True, timeout=10,
                    )
                else:
                    result = subprocess.run(
                        ["git", "diff", "HEAD"], cwd=cwd, capture_output=True, text=True, timeout=10,
                    )
                return (result.stdout or "")[:5000] or "(no diff)"

            elif name == "git_log":
                count = args.get("count", 10)
                result = subprocess.run(
                    ["git", "log", f"--oneline", f"-{count}"], cwd=cwd, capture_output=True, text=True, timeout=10,
                )
                return result.stdout.strip() or "(no commits)"

            elif name == "git_commit":
                msg = args.get("message", "")
                if not msg:
                    return "Error: commit message is required"
                subprocess.run(["git", "add", "-A"], cwd=cwd, capture_output=True, timeout=10)
                result = subprocess.run(
                    ["git", "commit", "-m", msg], cwd=cwd, capture_output=True, text=True, timeout=30,
                )
                return f"exit {result.returncode}\n{(result.stdout + result.stderr)[-2000:]}"

            elif name == "git_branch":
                branch_name = args.get("name", "")
                if branch_name:
                    result = subprocess.run(
                        ["git", "checkout", "-b", branch_name], cwd=cwd, capture_output=True, text=True, timeout=10,
                    )
                    return f"Created and switched to branch: {branch_name}" if result.returncode == 0 else result.stderr
                else:
                    result = subprocess.run(
                        ["git", "branch", "-a"], cwd=cwd, capture_output=True, text=True, timeout=10,
                    )
                    return result.stdout.strip() or "(no branches)"

            else:
                return f"Unknown tool: {name}"

        except subprocess.TimeoutExpired:
            return "Error: command timed out"
        except Exception as exc:
            return f"Error: {exc}"

    def _is_rate_limited(self, result: RunnerResult) -> bool:
        if not result.transcript_path or not Path(result.transcript_path).exists():
            return False
        try:
            content = Path(result.transcript_path).read_text()
            indicators = ["rate limit", "429", "quota exceeded", "too many requests", "RESOURCE_EXHAUSTED"]
            return any(i.lower() in content.lower() for i in indicators)
        except Exception:
            return False
