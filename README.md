# APEX-AI — Person D deliverables

This directory tree contains **Person D's** contributions to the APEX-AI
control plane: the **target repository**, the **deterministic validator**,
and the **demo direction**. It is self-contained and pre-proven — everything
here runs and passes today.

## What's here

```
target-repo/     A small FastAPI todo service the agent is pointed at.
                 - green baseline suite (tests/)
                 - objective acceptance suite (acceptance/)  <- red at base
                 - OBJECTIVE.md: the task the agent must complete
validation/      The deterministic validator + criteria.
                 - validator.py: exit-code-only verdict, ZERO LLM
                 - criteria.json: the four success criteria
                 - test_validator.py: self-test of the verdict logic
demo/            DEMO_SCRIPT.md, JUDGE_QA.md, prove.ps1
```

## The core guarantee

> The verdict is a pure function of process exit codes.
> `criterion passes  <=>  exit_code == expect_exit_code`
> `verdict           <=>  every criterion passes`

There is no model call in `validation/validator.py`. The LLM may only turn a
failing command's output into an advisory "what to fix next" note for the
next planner attempt — it never decides pass/fail.

## Three proven states of the target repo (git tags)

| tag              | verdict | detail                                        |
|------------------|---------|-----------------------------------------------|
| `base-green`     | FAIL    | feature absent: `pagination` + `edge-cases` red |
| `naive-red`      | FAIL    | fails **exactly** `edge-cases` (unvalidated paging) |
| `solution-green` | PASS    | all four criteria green                        |

This is the demo's spine: attempt 1 (naive) fails one real check, attempt 2
(solution) turns it green.

## Quick start

```powershell
# 1. create the venv and install target-repo deps
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r target-repo\requirements.txt

# 2. run the validator against the current repo state
.\.venv\Scripts\python.exe validation\validator.py --repo target-repo --criteria validation\criteria.json

# 3. prove the whole naive-vs-solution claim automatically
powershell -ExecutionPolicy Bypass -File .\demo\prove.ps1

# 4. self-test the validator's verdict logic
.\.venv\Scripts\python.exe -m pytest validation\test_validator.py -q
```

## Validator interface (for Person A's orchestrator)

```python
from validation.validator import check

report = check(criteria, repo_path)   # criteria: list[dict], repo_path: str
# report = {
#   "verdict": "pass" | "fail",
#   "passed": bool,
#   "total": int, "passed_count": int,
#   "criteria": [
#     { "id", "description", "command", "type",
#       "status": "pass"|"fail"|"error",
#       "exit_code", "expected_exit_code",
#       "duration_s", "evidence" }
#   ]
# }
```

`report["criteria"]` matches the run-state `criteria[...]` shape in the team
contract (`id, description, command, status, exit_code, evidence`), so the UI
can render it directly.

## Notes

- The validator is **standard-library only** — no install needed to run it.
- `target-repo/requirements.txt` covers fastapi / pytest / ruff / httpx.
- Confirmed working on **Python 3.14** (pydantic-core ships cp314 wheels).
