"""ReAct Agent Runner implementation using litellm."""

import json
import os
import subprocess
from pathlib import Path
from typing import Any

from backend.contracts.models import RunnerResult
from backend.runners.base import LogSink


class ReactRunner:
    def __init__(
        self,
        model: str = "gemini/gemini-3.5-flash",
        api_key: str | None = None,
        max_turns: int = 15,
    ) -> None:
        self.model = model
        self.api_key = api_key
        self.max_turns = max_turns

    def run(
        self,
        prompt: str,
        cwd: str,
        tools: list[str] | None = None,
        on_log: LogSink | None = None,
    ) -> RunnerResult:
        import litellm

        run_dir = Path(cwd) / ".run_output"
        run_dir.mkdir(parents=True, exist_ok=True)
        transcript_path = run_dir / "transcript.jsonl"

        files_changed = set()
        model_calls = 0
        transcript_entries = []

        def log_event(msg: str):
            if on_log:
                on_log(msg)

        system_prompt = (
            "You are an autonomous AI coding agent operating in a ReAct (Reason + Act) loop. "
            "You have tools to read files, write files, and execute shell commands (e.g. for git, testing, etc.). "
            "Think step-by-step. When you have completed the objective, or if you encounter an error you cannot recover from, "
            "output a final message summarizing what you did."
        )

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": prompt}
        ]

        transcript_entries.append({"role": "system", "content": system_prompt})
        transcript_entries.append({"role": "user", "content": prompt})

        agent_tools = [
            {
                "type": "function",
                "function": {
                    "name": "run_command",
                    "description": "Execute a shell command in the repository (e.g. git, pytest, ls).",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "command": {"type": "string", "description": "The shell command to run"}
                        },
                        "required": ["command"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "read_file",
                    "description": "Read the contents of a file from the repository.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "filepath": {"type": "string", "description": "Relative path to the file"}
                        },
                        "required": ["filepath"]
                    }
                }
            },
            {
                "type": "function",
                "function": {
                    "name": "write_file",
                    "description": "Write contents to a file in the repository.",
                    "parameters": {
                        "type": "object",
                        "properties": {
                            "filepath": {"type": "string", "description": "Relative path to the file"},
                            "content": {"type": "string", "description": "The full content to write to the file"}
                        },
                        "required": ["filepath", "content"]
                    }
                }
            }
        ]

        status = "failed"

        for turn in range(self.max_turns):
            log_event(f"--- Turn {turn + 1}/{self.max_turns} ---")

            kwargs = {}
            if self.api_key:
                kwargs["api_key"] = self.api_key

            try:
                response = litellm.completion(
                    model=self.model,
                    messages=messages,
                    tools=agent_tools,
                    **kwargs
                )
            except Exception as e:
                err_msg = f"LLM API Error: {e}"
                log_event(err_msg)
                transcript_entries.append({"role": "error", "content": err_msg})
                break

            model_calls += 1
            message = response.choices[0].message

            msg_dict = message.model_dump(exclude_none=True)
            messages.append(msg_dict)
            transcript_entries.append(msg_dict)

            if message.content:
                log_event(f"Thought: {message.content}")

            if not getattr(message, "tool_calls", None):
                log_event("No more tool calls. Exiting loop.")
                status = "success"
                break

            for tool_call in message.tool_calls:
                fn_name = tool_call.function.name
                args_str = tool_call.function.arguments
                log_event(f"Action: {fn_name}({args_str})")

                try:
                    args = json.loads(args_str)
                except Exception:
                    args = {}

                result_text = ""
                try:
                    if fn_name == "run_command":
                        cmd = args.get("command", "")
                        res = subprocess.run(cmd, shell=True, cwd=cwd, capture_output=True, text=True)
                        result_text = f"STDOUT:\n{res.stdout}\nSTDERR:\n{res.stderr}\nExit Code: {res.returncode}"
                    elif fn_name == "read_file":
                        fp = args.get("filepath", "")
                        abs_fp = os.path.join(cwd, fp)
                        with open(abs_fp, "r", encoding="utf-8") as f:
                            result_text = f.read()
                    elif fn_name == "write_file":
                        fp = args.get("filepath", "")
                        content = args.get("content", "")
                        abs_fp = os.path.join(cwd, fp)
                        os.makedirs(os.path.dirname(abs_fp), exist_ok=True)
                        with open(abs_fp, "w", encoding="utf-8") as f:
                            f.write(content)
                        files_changed.add(fp)
                        result_text = "File written successfully."
                    else:
                        result_text = f"Unknown tool {fn_name}"
                except Exception as e:
                    result_text = f"Error executing {fn_name}: {e}"

                log_event(f"Observation: {result_text}")

                tool_msg = {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": fn_name,
                    "content": result_text
                }
                messages.append(tool_msg)
                transcript_entries.append(tool_msg)

        # Write transcript
        with open(transcript_path, "w", encoding="utf-8") as f:
            for entry in transcript_entries:
                f.write(json.dumps(entry) + "\n")

        return RunnerResult(
            transcript_path=str(transcript_path),
            files_changed=list(files_changed),
            status=status,
            model_calls=model_calls
        )
