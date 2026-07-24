# AI Coding Loop — Control Plane for AI Coding Work (Track B)

An engineer defines an objective; four agent roles (Criteria → Planning →
Execution → Validation) work through it in a **bounded loop**. Acceptance is
**deterministic** — `all(exit_code == expected)`, no LLM in the verdict path.
Failure evidence feeds the next attempt. When the budget runs out, the system
**rolls back, re-verifies the workspace is green, and reports honestly as
undelivered**. Every run leaves receipts.

## Status

**Fully integrated — backend (49 tests, lint clean) + Person C's React Flow frontend.**

```
apex-ai/
├── backend/
│   ├── api/main.py          # FastAPI — the frontend's single integration point
│   ├── contracts/           # models.py (frozen shapes) + JSON schemas
│   ├── orchestrator/        # engine, dispatcher, transitions, attempts, rollback,
│   │   ├── handlers/        #   one handler per node type (validator = NO LLM)
│   │   └── state/           #   run-state helpers + EventType receipt vocabulary
│   ├── runners/             # Runner protocol: StubRunner (demo) / AiderRunner (real)
│   ├── prompts/             # criteria / planning / execution / retry_planning
│   └── fixtures/            # sample_run.json, sample_workflow_request.json
├── frontend/                # Next.js + React Flow canvas (Person C)
│   ├── src/lib/api.ts             # talks to the backend (single seam)
│   ├── src/lib/backend-adapter.ts # RunState (snake_case) -> UI Run shape
│   └── scripts/integration-check.ts  # live full-stack verification
├── tests/                   # 49 tests: runners, orchestrator, API end-to-end
└── runs/<id>/run.json       # generated receipts (gitignored)
```

## Quickstart

```bash
# 1. Backend
source venv/bin/activate
pip install -r requirements.txt
uvicorn backend.api.main:app --reload --port 8000

# 2. Frontend (second terminal)
cd frontend
npm install
npm run dev            # http://localhost:3000/canvas

# Verification
python -m pytest tests/ -q             # 49 passed
ruff check backend tests               # All checks passed!
cd frontend && npm run build           # compiles, TypeScript clean
node scripts/integration-check.ts      # live full-stack check (backend must be up)
```

The frontend auto-detects the backend via `GET /health`: backend up → real
orchestrated runs (human gate pauses for approval); backend down → scripted
demo mode with scenario selection. Config via `frontend/.env.local`
(see `.env.local.example`): API base, runner, target repo, green command.

## API — what the frontend consumes

Poll `GET /runs/{id}` every ~1s. No WebSockets.

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/runs` | Create + launch a real run (executes in background) |
| GET | `/runs/{id}` | Current `RunState`: node badges, event receipts, criteria evidence, cost |
| GET | `/runs` | Run summaries |
| POST | `/runs/{id}/stop` | Safe stop at next node boundary (work left in place) |
| POST | `/runs/{id}/approve` | Resolve a paused human gate: `{"approved": true\|false, "feedback": ""}` |
| POST | `/runs/fixture` | Canned 2-attempt run (fail→pass, awaiting approval) — free demo data |
| POST | `/workflows/export` | Validate a workflow config; response body IS the export JSON |

`POST /runs` body (see `backend/fixtures/sample_workflow_request.json` for the workflow shape):

```jsonc
{
  "workflow": { "entryNode": "...", "nodes": [...], "edges": [...] },
  "objective": "Add pagination to /todos ...",
  "maxAttempts": 3,
  // optional:
  "runner": "stub",            // "stub" (canned, instant) | "aider" (real LLM edits)
  "model": "groq/llama-3.3-70b-versatile",
  "repo_path": "/abs/path/to/target-repo",   // SET THIS for real runs
  "auto_approve": true,        // false = human gate really pauses (awaiting_approval)
  "green_command": "pytest -q" // baseline suite re-run after rollback (green proof)
}
```

Success criteria live on the criteria node's config — user-defined, agent-generated, or hybrid:

```jsonc
{ "id": "criteria", "type": "agent",
  "config": { "role": "criteria",
              "criteria": [ { "id": "c1", "description": "All tests pass",
                              "command": "pytest -q", "expect_exit_code": 0 } ] } }
```

## The three judge questions

1. **"Could the LLM ever make a red check go green?"** No. The verdict is
   `all(exit_code == expect_exit_code)` — see
   `backend/orchestrator/handlers/validator_handler.py` (no model call in it).
   The LLM only summarizes failures for the next attempt, labeled advisory.
2. **"What happens when it runs out of attempts?"** Rollback to the base git
   ref, then the baseline suite is **re-run post-rollback** and logged
   (`post_rollback_verification_passed`) — workspace proven green, run reported
   `delivered: false`.
3. **"Is the loop actually configurable?"** The graph is user-authored JSON —
   nodes, edges, criteria, max attempts, models, approval gates. The engine is a
   fixed interpreter over that config; export = the same JSON.

## Team ownership

| Area | Owner |
|------|-------|
| `orchestrator/`, `api/` | Person A |
| `runners/`, `prompts/` | Person B |
| `frontend/` (React Flow canvas) | Person C — integrated |
| target repo, demo | Person D |
