# APEX-AI — Demo Direction (6 minutes)

**One sentence to memorise:** *Objective in → bounded iterations → a green, evidenced result or an honest "undelivered, workspace clean." The verdict is a pure function of exit codes; the LLM never grades itself.*

The target repo, criteria, and the naive/solution states below are all real and pre-proven by `demo/prove.ps1`.

---

## Setup before you present

```powershell
# from repo root, once
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r target-repo\requirements.txt
powershell -ExecutionPolicy Bypass -File .\demo\prove.ps1   # must print PROOF PASSED
```

Leave the repo on `main` (the base state) at the start of the demo.

---

## The beats (≈6 min)

**0:00 — Frame the problem (30s).**
"Copilots produce plausible code with no verdict attached. The human is the only validator, so autonomy doesn't scale. We built the control plane, not another code generator. Here's a real repo, a real objective, and a verdict you can trust."

**0:30 — Show the objective and criteria (45s).**
Open `target-repo/OBJECTIVE.md` and `validation/criteria.json`. Four measurable criteria, each a shell command with an expected exit code. "The engineer can edit these — model, instructions, max iterations, and these validation commands are all configuration, not code."

**1:15 — Run against the base repo (45s).**
```powershell
.\.venv\Scripts\python.exe validation\validator.py --repo target-repo --criteria validation\criteria.json
```
Two red (pagination, edge-cases), two green (compat, lint). "The feature doesn't exist yet. This is attempt 0."

**2:00 — Attempt 1 fails on a real edge case (60s).**
Switch the repo to the naive state (this is what a first agent pass typically produces):
```powershell
git checkout naive-red
.\.venv\Scripts\python.exe validation\validator.py --repo target-repo --criteria validation\criteria.json
```
**Exactly one criterion is red: `edge-cases`.** Open `acceptance/test_edge_cases.py` and read the failing assertion aloud: `page=0` must return 422, the naive slice returns 200. "This is the failure that gets fed back to the planner for attempt 2. The LLM cannot argue its way past it — the test decides."

**3:00 — Attempt 2 passes (60s).**
Switch to the corrected state (what the agent produces after seeing the failure):
```powershell
git checkout solution-green
.\.venv\Scripts\python.exe validation\validator.py --repo target-repo --criteria validation\criteria.json
```
**VERDICT: PASS, 4/4.** Show the diff that made it green:
```powershell
git diff naive-red solution-green -- target-repo/app/main.py
```
"The only change is real input validation. Same tests, now green."

**4:00 — Determinism + honesty (60s).**
"Run it again — identical verdict, because it's `all(exit_code == expected)`, nothing else." Open `validation/validator.py` and point at the banner comment: no LLM in the verdict path. Mention the rollback story: on exhausted attempts the orchestrator rolls back and **re-runs the suite to prove the workspace is green** before reporting undelivered.

**5:00 — Prove the whole claim in one command (45s).**
```powershell
powershell -ExecutionPolicy Bypass -File .\demo\prove.ps1
```
"base → fail, naive → fails exactly one, solution → passes all four. Reproducible, not a story."

**5:45 — Land it (15s).**
"The receipts — commands, exit codes, evidence, diffs — are the product. The code generator is a commodity; the verdict you can defend is not."

---

## Backup

Record a screen capture of `prove.ps1` passing and of the three validator runs. If live git/venv misbehaves, play the capture and talk over it.

## The deliberately ambiguous objective (clarification path, if asked)

Have this ready: *"Make the todo list faster."* — no measurable criterion, no acceptance test can be written. Use it to show the system should **halt and ask for clarification** rather than fabricate a verdict.
