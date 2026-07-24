# The three questions judges will ask (rehearsed answers)

### 1. "Could the LLM ever make a red check go green?"

**No.** The verdict is `all(exit_code == expect_exit_code)`. Open
`validation/validator.py` — there is no model call, no heuristic, no
LLM-as-judge in that file; it says so in the banner comment at the top.
The LLM's only job near validation is turning a failing test's stdout into
a short "what to fix next" note for the next planner attempt, and that note
is labelled **advisory**. The verdict is labelled **deterministic**.

Proof on demand: `git checkout solution-green` and run the validator twice —
byte-identical verdict, because it depends only on process exit codes.

### 2. "What happens when it runs out of attempts?"

The orchestrator rolls the workspace back to the base commit **and then
re-runs the test suite to prove the workspace is green** before reporting
`undelivered`. We don't just claim the workspace is clean — we verify it and
log the post-rollback run as evidence. (Person A owns the rollback; Person D
provides the repo and validator it re-runs against.)

### 3. "Is the loop actually configurable?"

Yes. `validation/criteria.json` is data: each criterion is
`{id, description, type, command, expect_exit_code, timeout}`. Change a
command, an expected exit code, or add a criterion, and the validator's
behaviour changes with no code edit. The same applies to the workflow nodes
(model, instructions, max iterations) in `workflow.json`. Export is just
`JSON.stringify(currentWorkflow)`.

---

## Why exactly these four criteria

| id          | command                                          | guards                     |
|-------------|--------------------------------------------------|----------------------------|
| `compat`    | `python -m pytest tests -q`                       | existing API unchanged     |
| `pagination`| `python -m pytest acceptance/test_pagination.py`  | the new feature works      |
| `edge-cases`| `python -m pytest acceptance/test_edge_cases.py`  | **the seeded failure**     |
| `lint`      | `ruff check .`                                    | style / import hygiene     |

The `edge-cases` criterion is the one a naive implementation fails: it slices
the list without validating `page`/`page_size`, so invalid input returns 200
instead of 422. `demo/prove.ps1` proves the naive state fails **only** this
criterion and the solution state passes all four.

## Stated assumptions (say these out loud)

Single repo, single user, local execution, one language ecosystem, trusted
network, no concurrent runs.
