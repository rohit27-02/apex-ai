"""Generate JSON schemas from Pydantic models.

Run from project root: python contracts/generate_schemas.py
"""

import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from contracts.models import Workflow, RunState


def main():
    contracts_dir = Path(__file__).parent

    # Workflow schema
    workflow_schema = Workflow.model_json_schema()
    workflow_path = contracts_dir / "workflow.schema.json"
    workflow_path.write_text(json.dumps(workflow_schema, indent=2))
    print(f"Wrote {workflow_path}")

    # RunState schema
    run_state_schema = RunState.model_json_schema()
    run_state_path = contracts_dir / "run_state.schema.json"
    run_state_path.write_text(json.dumps(run_state_schema, indent=2))
    print(f"Wrote {run_state_path}")


if __name__ == "__main__":
    main()
