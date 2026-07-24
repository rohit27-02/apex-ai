"""Run state persistence."""

from __future__ import annotations

from pathlib import Path

from contracts.models import RunState


class RunStateManager:
    """Manages persisting and loading run state to runs/<id>/run.json."""

    def __init__(self, runs_dir: str = "runs") -> None:
        self.runs_dir = Path(runs_dir)

    def save(self, run: RunState) -> Path:
        """Save run state to disk."""
        run_dir = self.runs_dir / run.run_id
        run_dir.mkdir(parents=True, exist_ok=True)
        path = run_dir / "run.json"
        run.save(path)
        return path

    def load(self, run_id: str) -> RunState | None:
        """Load run state from disk."""
        path = self.runs_dir / run_id / "run.json"
        if path.exists():
            return RunState.load(path)
        return None

    def list_runs(self) -> list[str]:
        """List all run IDs."""
        if not self.runs_dir.exists():
            return []
        return [d.name for d in self.runs_dir.iterdir() if d.is_dir()]
