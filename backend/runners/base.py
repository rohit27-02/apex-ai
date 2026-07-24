"""Runner protocol — the integration boundary for agent execution.

Person A calls Runner.run(). Person B implements it.
Swap between StubRunner and AiderRunner by changing one config value.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from backend.contracts.models import RunnerResult


@runtime_checkable
class Runner(Protocol):
    def run(
        self,
        prompt: str,
        cwd: str,
        tools: list[str] | None = None,
    ) -> RunnerResult:
        """Execute an agent step in the given repo directory.

        Args:
            prompt: The full prompt to send to the agent.
            cwd: Absolute path to the repo working directory.
            tools: Optional list of tool names the agent may use.

        Returns:
            RunnerResult with transcript path, changed files, status, and call count.
        """
        ...
