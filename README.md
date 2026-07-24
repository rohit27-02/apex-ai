# AI Coding Loop - Project Structure

```text
ai-coding-loop/
│
├── README.md
├── pyproject.toml
├── .env.example
├── .gitignore
│
├── contracts/                         # Shared contracts — agree with all 4
│   ├── workflow.schema.json
│   ├── run_state.schema.json
│   └── models.py                      # Pydantic models
│
├── api/                               # Person A
│   ├── __init__.py
│   ├── main.py                        # FastAPI app entry point
│   └── routes/
│       ├── __init__.py
│       ├── runs.py                    # POST /runs, GET /runs/{id}
│       └── workflows.py               # POST /workflows/export
│
├── orchestrator/                      # Person A
│   ├── __init__.py
│   │
│   ├── engine.py                      # Main workflow execution loop
│   ├── dispatcher.py                  # Maps node type → handler
│   ├── transitions.py                 # Decides next node
│   ├── attempts.py                    # Attempt/retry management
│   ├── rollback.py                    # Git rollback + green verification
│   │
│   ├── handlers/
│   │   ├── __init__.py
│   │   ├── input_handler.py
│   │   ├── agent_handler.py
│   │   ├── command_handler.py
│   │   ├── validator_handler.py
│   │   ├── decision_handler.py
│   │   ├── human_gate_handler.py
│   │   └── terminal_handler.py
│   │
│   └── state/
│       ├── __init__.py
│       ├── run_state.py               # Runtime state management
│       └── event_log.py               # Append events / receipts
│
├── runners/                           # Person B
│   ├── base.py
│   ├── stub_runner.py
│   └── claude_runner.py
│
├── validation/                        # Person D
│   ├── validator.py
│   └── models.py
│
├── prompts/                           # Person B
│   ├── criteria.txt
│   ├── planning.txt
│   ├── execution.txt
│   └── retry_planning.txt
│
├── target-repo/                       # Person D
│   └── ...actual demo repository...
│
├── workflows/                         # Workflow definitions
│   └── default_workflow.json
│
├── runs/                              # Generated execution receipts
│   └── <run-id>/
│       ├── run.json
│       └── attempts/
│           ├── attempt-1/
│           │   ├── transcript.jsonl
│           │   ├── events.jsonl
│           │   └── validation.json
│           │
│           └── attempt-2/
│               ├── transcript.jsonl
│               ├── events.jsonl
│               └── validation.json
│
├── web/                               # Person C
│   └── ...
│
└── demo/                              # Person D
    └── ...
```
