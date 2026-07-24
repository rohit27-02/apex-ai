"""Runner protocol — the integration boundary for agent execution.

Person A calls Runner.run(). Person B implements it.
Swap between StubRunner and AiderRunner by changing one config value.
"""

from __future__ import annotations

from typing import Callable, Protocol, runtime_checkable

from backend.contracts.models import RunnerResult

# Called with each log line as the agent produces it (thinking, tool use, output).
# The orchestrator uses this to stream live per-node logs to the UI.
LogSink = Callable[[str], None]


@runtime_checkable
class Runner(Protocol):
    def run(
        self,
        prompt: str,
        cwd: str,
        tools: list[str] | None = None,
        on_log: LogSink | None = None,
    ) -> RunnerResult:
        """Execute an agent step in the given repo directory.

        Args:
            prompt: The full prompt to send to the agent.
            cwd: Absolute path to the repo working directory.
            tools: Optional list of tool names the agent may use.
            on_log: Optional callback invoked with each output line as it is
                produced, enabling live streaming of the agent's work.

        Returns:
            RunnerResult with transcript path, changed files, status, and call count.
        """
        ...
