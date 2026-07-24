Below is the conversation i had with claude code.
I am the person B here.

Problem Statement 1
Autonomous AI Coding Loop
Build the machinery that makes long-running, model-written coding work trustworthy — where
models generate and deterministic checks accept. Participants build one shared core loop, then
complete it through one of two tracks.
The Challenge
Long coding tasks rarely succeed with a single prompt. Writing code was never the bottleneck
— the bottleneck is everything wrapped around the code: understanding the objective,
honouring conventions, proving correctness, recovering from failure, and knowing when to stop
and ask a human. Copilots help a developer type faster. They do not deliver.
Your challenge is to build an autonomous AI coding loop that can:
1. Understand the desired outcome.
2. Define what success means.
3. Create a plan.
4. Make changes.
5. Validate the result.
6. Use feedback to try again.
7. Stop when the task succeeds or reaches a safe limit.
We are not asking whether you can prompt a model into producing code. We know you can. We
are asking whether you can build the machinery that makes model-written code trustworthy
enough to merge.
Shared Core Requirements (Both Tracks)
Whichever track you choose, your system must demonstrably do the following:
•
Plan like a senior engineer. Turn a prose requirement or objective into a concrete,
grounded plan: which modules, which entities, which existing patterns to follow, what order
of work, what could go wrong. A plan that names real files beats a plan that names ideas.
•
Separate generation from acceptance. This is the heart of the challenge. Language
models are eloquent about code that does not work. Generation is where models are free;
acceptance is where they are forbidden. Acceptance belongs to executable checks — the
compiler, the linter, tests, static analysis, migration apply-and-rollback. A change advances
only when the checks say so. An LLM's opinion, however confident, must never turn a red
check green. Given the same state, the acceptance verdict must be identical every time.
•
Feed failure back into the loop. When validation fails, the system must produce
actionable feedback, pass it into the next attempt, and increase the iteration count.
•
Stay bounded — recover or retreat cleanly. Retries operate within a budget you define.
When the budget runs out, the system must roll the work back, leave the workspace in a
green state, and report the work honestly as undelivered. Unlimited autonomous execution
is not acceptable. A partial delivery with an honest report is professional; a broken branch
is disqualifying.
•
Know when to ask instead of answer. When a requirement is ambiguous or
self-contradictory, the system that notices, halts, and emits a structured clarification
request earns credit. The system that confidently implements a guess earns nothing.
•
Keep receipts. Every run must leave an inspectable trail: which component did what,
which files it touched, commands and tools used, what each verification step concluded,
retry reasons, and what it all cost — model interactions, iterations, and wall-clock time. If
we ask "why did the system merge this?" the answer must be a log, not a shrug.

•
Integrate a real agent runner. Use at least one coding-agent harness or agent SDK (e.g.,
OpenCode, Strands Agents, DeepAgents, Aider, Claude Code, Codex, or equivalent) with
file-system capabilities: reading, creating, editing, and deleting files; searching repository
contents; running shell commands; executing tests, builds, and validation scripts;
inspecting diffs; and capturing the agent transcript and execution status. Model, provider,
and execution backend should be configurable rather than tightly coupled to the
orchestration logic.
Validation may combine deterministic checks (builds, unit and integration tests, linting, type
checking, static analysis, coverage thresholds, file checks, API or schema validation,
performance checks), LLM-as-a-judge for qualitative areas (architectural alignment, readability,
documentation quality, adherence to conventions — with a clear rubric and structured
evidence), and human review for high-risk changes, security-sensitive code, public API
changes, database changes, and final approval.
Choose one track below. The core loop is common to both; the tracks differ in what surrounds it.


Track B — Loop Engineering Platform: A Control Plane for AI Coding Work
Build a platform that allows engineers to create, run, and inspect AI coding loops — a credible
control plane for long-running AI coding work, not another chat interface.
The Platform
Build a platform that allows an engineer to define, configure, execute, and inspect an
AI-assisted workflow for completing a non-trivial coding task. The platform must provide a
default loop with four roles:
•
Success Criteria Agent — Converts the engineering objective into measurable
completion criteria.
•
Planning Agent — Creates or revises the implementation plan.
•
Execution Agent — Makes changes in the codebase.
•
Validation Agent — Checks whether the task is complete and provides evidence when it
is not.
Default loop flow:

Engineering objective → Success Criteria Agent → engineer confirms the contract (or edits
criteria) → Planning Agent → Execution Agent → Validation Agent. If validation passes: through
a human gate (if required) to Task Successful. If validation fails with evidence: back to the
Planning Agent while attempts remain, otherwise Stopped Safely. A rejected human gate also
ends in Stopped Safely.
This should be a configurable template, not a fixed hardcoded sequence. Users should be able
to adjust: agent instructions; models or coding-agent providers; tools available to each agent;
success criteria; validation checks; maximum iterations; failure paths; human approval points;
and completion conditions.
The prototype must run one real coding task against a repository — one that requires planning,
implementation, validation, and iteration (e.g., adding a feature across multiple files, fixing a
complex bug, refactoring a large component, migrating a module, replacing a deprecated
dependency, adding tests to an untested module, converting synchronous code to
asynchronous, improving performance against a measurable target, or resolving security or
static-analysis findings). Keep the task challenging but demonstrable within the event.
The primary user is an engineer or technical lead who has access to a source repository, knows
the desired engineering outcome, may not know every implementation step, wants AI agents to
work through the task iteratively, needs evidence that the task is complete, and must be able to
inspect, stop, edit, and approve the process.
Success Criteria Definition
The platform should support three ways of defining success: user-defined (the engineer writes
the criteria), agent-generated (the agent proposes them), and hybrid (the engineer provides the
objective and constraints; the agent proposes measurable criteria for approval). Hybrid should
be the default. Before execution, the engineer should be able to review, edit, prioritize, and
confirm the criteria, including any human approvals.
Possible criteria include: the project builds successfully; existing tests continue to pass; new
tests are added; a required file or feature exists; protected files are not modified; coverage
reaches a threshold; performance improves against a baseline; public APIs remain compatible;
the implementation follows the requested architecture.
Build the Loop Visually
The core experience should be a visual node canvas inspired by tools such as Rivet — a
graph-editor layout rather than a wizard or dashboard made from separate forms. The user
should be able to add nodes from a small node library, connect nodes to define execution order,
select a node and edit its settings, configure success and failure paths, run the complete graph,
and see the status and output of each node.
Minimum node library:
•
Input — provides the coding objective and constraints.
•
Agent — performs criteria creation, planning, or implementation.
•
Command — runs a build, test, or repository command.
•
Validator — decides whether defined criteria are satisfied.
•
Decision — chooses the next path based on a result.
•
Human Gate — pauses for approval or feedback.
•
Success / Stop — completes or safely terminates the run.
The main screen should contain five areas: a top bar (workflow name; save and export; run,
pause, and stop controls; run status; attempt counter), the node library panel, the graph canvas pause, and stop controls; run status; attempt counter), the node library panel, the graph canvas
(each node showing name, type, status, configuration summary, connection points, and latest
result during a run), a node inspector (name, instructions, model, tools, command, validation
criteria, retry limit, timeout, success and failure paths — only settings relevant to the selected

node), and a collapsible run console (agent messages, commands executed, files changed,
validation evidence, errors, retry reasons, human feedback; clicking a completed or failed node
inspects what happened during its execution).
The canvas does not need advanced graph-editing features such as nested graphs, automatic
layout, collaboration, or hundreds of node types.
Session Inspection & Configuration as Code
The user must be able to inspect what each agent did — at minimum: agent input, agent output,
commands and tools used, files created or changed, validation results, retry reason, and current
status. Live token streaming is optional.
The workflow created in the UI should be exportable as YAML or JSON, describing the agents,
their instructions and tools, the task contract, validation checks, retry limits, workflow transitions,
and approval requirements. Importing and rerunning the same configuration is desirable.
Required Demonstration (Track B)
1. A coding objective being entered.
2. Success criteria being generated or edited.
3. The four-agent loop being configured.
4. The workflow being saved or exported.
5. An execution attempt running against a repository.
6. A real validation result, with evidence visible.
7. A failed attempt feeding back into another iteration.
8. A later success, or a safe stop after attempts are exhausted.
9. Agent sessions and file changes being inspectable.
A deliberately failed first attempt may demonstrate the loop. Recommended demo duration: five
to seven minutes.
Bonus Capabilities (Track B)
•
Token, model-call, or cost tracking
•
Live agent or command streaming
•
Git worktrees, containers, or isolated attempts
•
Pause, resume, or checkpoint recovery
•
Reusable versioned templates
•
External coding-harness or multi-provider integration
Desired Outcome (Both Tracks)
A small but credible autonomous AI coding system: engineers define outcomes instead of
micromanaging prompts; agents work through configurable roles; validation drives the next
iteration; every run leaves inspectable evidence; autonomy remains bounded; and the same
loop can be rerun. The winning solution makes long-running AI coding work feel controlled,
measurable, and repeatable.


Good problem. Track B is the harder of the two to demo but the easier one to impress with, because judges can see the machinery. It's also the one most likely to sink a 4-person team, because it asks for a visual graph editor and a real agent loop and a real repo task. Let's cut it down.

Phase 1 — Understand

The actual problem: not "can an AI write code" but "can you prove an AI's code is acceptable, and show the receipts." The product is the control plane, not the code generator.

The user: a tech lead who owns a repo, knows the outcome, doesn't want to babysit prompts, and will be blamed if bad code merges. They need to inspect, stop, and approve.

Current pain: copilots produce plausible code with no verdict attached. The human is the only validator, so autonomy doesn't scale.

Desired outcome: objective in → bounded iterations → either a green, evidenced result or an honest "undelivered, workspace clean."

Core I/O: In = objective + repo + constraints. Out = pass/fail verdict + evidence + file diffs + run log + cost/iteration counters + exported workflow config.

Explicitly required (the 9 demo steps are your real spec — treat that list as the grading rubric).

Implied but not stated — this is where teams lose points:

"Given the same state, the verdict must be identical every time" means your verdict must be a pure function of exit codes, not of any LLM output. Store the exact commands and exit codes so you can prove it.
"Leave the workspace green" implies you must verify greenness after rollback. Run the test suite again post-rollback and log it. Almost nobody will do this. It's ~15 minutes of work and it's a killer demo beat.
"Configurable template, not a hardcoded sequence" means a judge will click a node and change something. At least model, instructions, max iterations, and validation commands must actually be editable and actually take effect.
"Keep receipts" plus the bonus list means iterations / wall-clock / model-call counts are must-have; token and dollar cost are good-to-have.
The clarification path needs a demoable trigger. You need one deliberately ambiguous objective in your back pocket.

Assumptions you're making (make them explicit to judges): single repo, single user, local execution, one language ecosystem, trusted network, no concurrent runs.

What impresses judges: a red check that an LLM cannot turn green; a failed attempt whose feedback visibly changes attempt 2; a clean rollback; and clicking a node to see exactly what happened. Not the prettiness of the canvas.

Phase 2 — Narrow
The one insight that saves your hackathon

The graph editor is not a program. It is a view over a config file.

Define workflow.json first. The executor runs the JSON. The canvas reads and writes the same JSON. This collapses three problems into one, and gives you demo requirement #4 (export) for free — export is JSON.stringify(currentWorkflow).

Do not build a graph engine where nodes hold behaviour. Build a fixed executor that interprets a config.

The single core user journey (memorise this — it's your demo)

Engineer types an objective → sees 4 measurable success criteria proposed → edits one, confirms → clicks Run → nodes light up in sequence → attempt 1 fails on a real test with the failure text visible → planner receives that failure → attempt 2 passes → Success node turns green → engineer clicks any node and sees its input, output, commands, and file diffs.

Everything that doesn't serve that sentence is out of scope until it works.

POC definition
	
Min input	Objective string + hardcoded repo path
Min processing	4 agent steps, real file edits, real pytest, max 3 attempts, git rollback
Min output	Verdict + criteria table with per-criterion evidence + run event log + diff
Success criteria for the POC	Two consecutive clean end-to-end runs, under 5 minutes each, no manual intervention
Must be real	Agent file edits, shell commands, test execution, exit-code verdict, git rollback, run log
Can be mocked initially	Human Gate (auto-approve button), cost numbers, clarification path
Can be hardcoded	The graph itself (ship the default 4-agent loop pre-drawn), node library contents, repo path, criteria templates
Feature tiers

Must-have (this is your submission): objective input; hybrid criteria generation with edit/confirm; the four-agent loop executing for real; deterministic validator; failure feedback into attempt 2; bounded retries with rollback + green verification; run event log; node inspector; JSON export.

Good-to-have (only after the above runs twice): clarification/halt path; human gate that actually blocks; drag-to-connect editing on canvas; token/cost counters; import + rerun.

Stretch: git worktrees per attempt; pause/resume; second provider behind the runner interface; versioned templates.

Explicitly avoid: auth, multi-user, database beyond SQLite-or-JSON-files, containers, nested graphs, auto-layout, token streaming, custom agent framework, LLM-as-judge, coverage thresholds, running against a large open-source repo.

Key Engineering Decisions
Decision 1 — Agent runner

Decision: Claude Code in headless mode (claude -p --output-format stream-json) wrapped behind a Runner interface with two implementations.

Why: it already has file read/write/delete, search, shell, and a structured transcript. That satisfies "integrate a real agent runner" on day one with near-zero code. The interface (run(prompt, cwd) -> {transcript, files_changed, status}) is ~20 lines and directly answers "model and backend must be configurable rather than coupled to orchestration."

Alternatives: Aider (--yes --message) — auto-commits per change, nice diff trail, weaker transcript. Raw SDK + your own tool loop — you'll spend 6 hours rebuilding what exists.

Trade-off: you gain speed and lose fine-grained control over the agent's internal steps. Fine for a POC.

Do now: ship ClaudeCodeRunner + StubRunner (returns a canned diff). The stub lets the frontend and orchestrator work while the runner is still being built, and it makes your demo rehearsals free.

Decision 2 — Stack

Decision: FastAPI + SQLite (or plain JSON files under runs/<id>/) + React with @xyflow/react (React Flow).

Why: agent SDKs are Python-first; React Flow gives you a Rivet-style canvas in about two hours. Poll GET /runs/{id} every second rather than WebSockets — polling never breaks on stage.

Decision 3 — The validator (the heart)

Decision: each criterion is {id, description, type, command, expect_exit_code}. The validator runs the commands, records exit codes and stdout, and the verdict is all(exit_code == expected). No LLM in the verdict path.

An LLM is allowed exactly one job here: turning failing stdout into a short "what to fix next" note for the planner. Label that clearly in the UI as advisory, and label the verdict as deterministic. Say this sentence out loud in your demo — it is the single most gradeable line in the problem statement.

Decision 4 — Target repo

Decision: you build it. A ~8-file FastAPI todo service with a pytest suite. Task: "Add pagination and status filtering to GET /todos, keep the existing API compatible, add tests."

Why: multi-file, genuinely testable, and you control the failure. Seed a test that a naive implementation fails (e.g. limit=0 or an out-of-range page must return an empty list, not a 500). Attempt 1 fails honestly, attempt 2 passes. That's demo requirement #7 handed to you on a plate.

Integration contract — agree on this in the first hour

Everything else depends on these two shapes. Write them into the repo before anyone writes logic.

workflow.json   { name, nodes[{id,type,name,config}], edges[{from,to,on:"success"|"failure"}],
                  max_attempts, repo_path }

run state       { run_id, status, attempt, max_attempts, started_at, cost:{model_calls,seconds},
                  node_states{ node_id: {status, summary} },
                  events[{ts, node_id, type, payload}],
                  criteria[{id, description, command, status, exit_code, evidence}] }

Critical path: contract → orchestrator state machine → runner → validator → UI binding.
Parallelizable: frontend canvas, target repo + criteria, prompt design — all against the stub runner.
Integration point: GET /runs/{id} returning the run state above. Nothing else.
Biggest risk: integrating too late. Mitigate by having the backend serve a fake completed run from a static JSON file within the first 90 minutes so the frontend is never blocked.

Next 3 Tasks
Task 1 — Freeze the contract and stub the API
Owner: Person A (backend/orchestrator lead), with all four in the room for 30 minutes
Objective: eliminate the integration risk before it exists.
Concrete action: write workflow.json and the run-state shape into the repo. Stand up FastAPI with POST /runs, GET /runs/{id}, POST /workflows/export. Have GET /runs/{id} return a hand-written fake run — 2 attempts, first failing, second passing — from a static file.
Expected output: a running server the frontend can hit immediately.
Effort: 90 minutes.
Definition of done: Person C can curl a realistic failed-then-passed run and start rendering it.
Task 2 — Build the target repo and the criteria set
Owner: Person D
Objective: the loop needs something real to chew on, and you need to own the failure.
Concrete action: create the FastAPI todo repo, ~8 files, green pytest suite, committed to git. Write the pagination/filtering objective. Hand-write the 4 success criteria as commands (pytest -q, pytest tests/test_pagination.py -q, ruff check ., git diff --name-only | grep -qv protected/). Seed the edge-case test that a naive fix will fail.
Expected output: repo at a known-green commit + a criteria.json.
Effort: 2 hours.
Definition of done: you can prove by hand that a naive implementation fails exactly one criterion, and a correct one passes all four.
Task 3 — Runner interface with a stub and a real implementation
Owner: Person B
Objective: de-risk the one component that can silently eat four hours.
Concrete action: define Runner.run(prompt, cwd) -> RunnerResult{transcript, files_changed, exit_status}. Ship StubRunner first (applies a canned patch), then ClaudeCodeRunner shelling out to headless mode. Capture the transcript to disk.
Expected output: a script that takes a prompt and a repo path and returns changed files.
Effort: 2–3 hours.
Definition of done: running the real runner against the Task 2 repo produces an actual file diff, and swapping to the stub requires changing one config value.

Person C starts the React Flow canvas in parallel against Task 1's fake run — render the 7 node types, wire node click → inspector panel. No editing yet, display only.

Do Not Do Yet
Drag-to-connect graph editing. Ship the default loop pre-drawn.
The clarification/halt path.
Cost and token tracking.
Human Gate as a real blocking pause — a disabled "Approve" button is enough today.
Any second agent provider.
Definition of Done for today

One hardcoded workflow runs end to end against your repo, fails attempt 1 on a real test, passes attempt 2, and the UI shows both attempts with clickable node details.

Post your progress when Tasks 1–3 land and I'll tell you the next three. If you find yourselves debating canvas features before that run works, stop and re-read this paragraph.

divide the current work, btw 4 guys, more descriptive to complete.
Some architectural wuestion? are we using langraph, or SDK

Searched the web, viewed a file
Searched the web, viewed a file
First: the architecture question
Decision

No LangGraph. Hand-write the state machine. Use an agent SDK/harness only for the agent step.

Your system has two layers, and the mistake is conflating them:

Layer	What it is	What to use
Orchestration	while-loop over attempts, node transitions, retry budget, rollback, event log	Your own Python — ~200 lines
Agent execution	one agent doing real file edits + shell in a repo	Claude Agent SDK or claude -p headless
Why not LangGraph

The problem statement says the loop must be "a configurable template, not a fixed hardcoded sequence," editable in a UI and exportable as YAML/JSON. That is the crux.

LangGraph defines graphs in Python code. Your graph lives in a JSON file the user edits on a canvas. So you'd have to write a compiler: workflow.json → LangGraph StateGraph → run → map LangGraph events back onto your node IDs for the UI. You are writing a translation layer around a framework in order to do something the framework wasn't shaped for. That's 4–6 hours of pure overhead plus a debugging surface you don't control at 3am.

Your graph is also tiny and mostly linear: Criteria → Gate → Plan → Execute → Validate → (loop | stop). Five nodes and one back-edge. A while attempt < max_attempts loop with a dict of node handlers is the correct implementation.

python
NODE_HANDLERS = {
  "input": handle_input, "agent": handle_agent, "command": handle_command,
  "validator": handle_validator, "decision": handle_decision,
  "human_gate": handle_human_gate, "terminal": handle_terminal,
}

def run_workflow(wf, run):
    node = wf.entry_node
    while node and run.status == "running":
        result = NODE_HANDLERS[wf.nodes[node].type](wf.nodes[node], run)
        run.emit(node, result)                      # receipts
        node = next_node(wf, node, result.outcome)  # follows edges in the JSON

That's the core. It's readable, it's yours, and every line maps to a grading criterion.

Which SDK for the agent step

Confirmed current as of this week: Claude Code runs non-interactively with -p/--print, supports --output-format text|json|stream-json, and pre-approves tools via --allowedTools and --permission-mode so unattended runs never block on a prompt. --bare skips ambient discovery (CLAUDE.md, hooks, MCP autoload) and is the documented recommendation for scripted/SDK-style calls; it requires an explicit ANTHROPIC_API_KEY. 
Amux
Build This Now

Take the CLI subprocess route, not the SDK, for the POC. Reasons: it's a subprocess, so a hung agent is proc.kill() instead of a Python-level cancellation problem; the transcript is JSON on stdout you can persist verbatim as your receipt; and swapping to Aider or Codex later means changing a command string. Move to the Agent SDK only when you're building a real program around Claude Code — that's your Sunday-morning upgrade, not your Friday-night one. 
Hidekazu-konishi

claude -p --bare --output-format stream-json \
       --permission-mode acceptEdits --max-turns 25 \
       --cwd <repo> "<prompt>"

Two warnings: verify these flags against claude --help on your actual installed version in the first 10 minutes — don't trust me or a blog post. And don't hard-code assumptions about specific non-zero exit codes; a complete enumerated table isn't published. Treat non-zero as "agent step failed," parse the transcript for detail. 
Build This Now

Docs: https://docs.claude.com/en/docs/claude-code/overview

Trade-off

You gain full control, trivial debugging, and a graph that's genuinely data-driven (which is 30% of the Track B rubric). You lose LangGraph's checkpointing and interrupt primitives — but you need a user-visible pause anyway, which is a status="awaiting_approval" field plus a poll. You were going to build that regardless.

One thing you might still want LangGraph-shaped

If a judge asks "why not LangGraph?", answer: "Our graph is user-authored data, not code. A framework that defines graphs in Python would have forced us to write a compiler between the canvas and the runtime." That's a strong answer. Rehearse it.

Work division — 4 people

Principle: each person owns directories nobody else edits, and produces exactly one interface others consume. This is how you avoid merge hell and the classic hackathon failure of four beautiful pieces that don't connect.

/contracts/         schemas.py + workflow.schema.json   ← written together, then FROZEN
/orchestrator/      A
/runners/           B
/validation/        D
/web/               C
/target-repo/       D
/runs/              generated output
Person A — Orchestrator & Run State (the spine)

Owns: /orchestrator/, /api/. The state machine, run lifecycle, event log, retry budget, rollback, FastAPI.

Consumes: Runner from B, Validator from D.
Produces: GET /runs/{id} — the single integration point for the whole team.

Hours	Work
0–1.5	Write the contract with everyone in the room. FastAPI up. GET /runs/{id} serves a hand-written fake run from static JSON: 2 attempts, first fails, second passes. C is unblocked forever after this.
1.5–4	The state machine. Node dispatch table, edge traversal, attempt counter, event emission. Call B's StubRunner and D's Validator.
4–6	Rollback: git stash or git checkout -- . per failed attempt, git checkout <base> on budget exhaustion. Then re-run the test suite post-rollback and log the result as a green-state proof.
6–8	Swap StubRunner → ClaudeCodeRunner. Cost counters: model calls, attempts, wall-clock.

Must not touch: React, prompt text, the target repo.
Personal risk: you are the critical path. If you're blocked, say so within 15 minutes, don't debug alone.

Person B — Agent Runner & Prompt Engineering

Owns: /runners/, /prompts/.

Produces: Runner.run(prompt, cwd, tools) -> RunnerResult{transcript_path, files_changed[], status, model_calls}

Hours	Work
0–0.5	In the contract meeting. Then immediately: claude --help, verify every flag, run one manual headless invocation against a scratch repo. If this doesn't work in 30 minutes, tell the team now — the whole plan pivots to Aider.
0.5–1.5	StubRunner: applies a canned patch, returns a fake transcript. Ship this to A before the real one. It makes every demo rehearsal free and instant.
1.5–4	ClaudeCodeRunner: subprocess, stream-json parsed line by line into events, transcript persisted to runs/<id>/attempt-<n>/transcript.jsonl, timeout + kill, git diff --name-only for files_changed.
4–7	The four role prompts. This is craft work, not boilerplate — the criteria prompt must return strict JSON with shell commands, and the planning prompt must name real files (feed it git ls-files + tree). "A plan that names real files beats a plan that names ideas" is a direct quote from the statement; make the planner literally output file paths.
7–8	Failure-feedback prompt: last attempt's plan + failing criterion + stderr tail → revised plan. Verify by eye that attempt 2's plan actually differs from attempt 1's. If it doesn't, your feedback loop is cosmetic and judges will spot it.

Must not touch: the state machine, React.
Personal risk: prompts that return prose instead of JSON. Ask for JSON, then parse defensively, then retry once with the parse error appended.

Person C — Canvas, Inspector & Run Console

Owns: /web/ entirely. Nobody else opens this folder.

Consumes: GET /runs/{id} — polled every 1s. Never touch WebSockets. Polling has never once failed on stage.

Hours	Work
0–0.5	Contract meeting. Insist that the run-state shape contains everything you need to render, because you will not be able to renegotiate it at hour 6.
0.5–3	React Flow canvas, 7 node types, custom node component showing name / type / status badge / config summary. Ship the default loop pre-drawn from workflow.json. Bind to A's fake run. Colour transitions on status.
3–5	Node inspector panel: click node → its settings, editable. Only relevant fields per type (Agent shows model + instructions + tools; Command shows the command; Validator shows criteria + retry limit). Edits write back into the workflow object.
5–7	Run console (collapsible, bottom): the event stream. Agent messages, commands run, files changed, validation evidence, retry reasons. Clicking a node filters the console to that node's execution. This is demo requirement #9 — it's not optional polish.
7–8	Top bar: workflow name, Run/Stop, run status, attempt counter (2/3), Export JSON button (JSON.stringify + download). Criteria review screen: table with editable rows + Confirm.

Must not touch: any Python.
Personal risk: spending three hours on drag-to-connect edge editing. Don't. Judges want to see nodes light up during a run, not authoring ergonomics. Editing node settings satisfies "configurable"; editing node topology is a stretch goal.

Person D — Target Repo, Validator & Demo Direction

Owns: /target-repo/, /validation/, /demo/. Front-loaded build, then becomes the integrator.

Produces: Validator.check(criteria[], repo_path) -> CriterionResult[] — pure subprocess execution, exit codes, captured stdout/stderr. Zero LLM in this file. Make that a comment at the top; open that file during the demo if judges ask.

Hours	Work
0–2	The target repo: ~8-file FastAPI todo service, green pytest suite, committed. Seed the edge-case test a naive implementation fails. Prove by hand that naive → exactly one red criterion, correct → all green. Tag both commits.
2–4	The validator. Subprocess per criterion, timeout, truncate output to last ~2KB, structured result. Test it standalone against both tagged commits.
4–6	Integration. You are the one person not blocked by their own component. Sit next to A, wire B's runner and your validator into the loop, run it end to end, fix the seams.
6–8	Demo direction: write the 6-minute script, run it twice, record a backup video. Prepare the ambiguous objective for the clarification path if time allows. Prepare the answers to the three questions judges will ask (see below).

Must not touch: React, the state machine internals.
Personal risk: perfecting the target repo. Eight files. Stop at eight files.

Integration checkpoints — non-negotiable
T+2h: A's fake run renders in C's canvas. B's stub runner returns a diff. D's repo is green. If any of these missed, cut scope now, not at hour 7.
T+5h: One real end-to-end run with stub runner + real validator + real rollback.
T+8h: Real agent runner swapped in. Full loop, real failure, real retry.
T+10h: Feature freeze. Everything after this is rehearsal and bugfix.
Dependency map
CONTRACT (all 4, 30 min)
   ├─→ A: state machine ──┐
   ├─→ B: runner ─────────┼─→ D: integration ─→ demo
   ├─→ D: validator ──────┘
   └─→ C: canvas ─────────→ (only needs GET /runs/{id})

C is fully decoupled after the contract. A is the critical path. B is the highest-variance risk. D is the shock absorber.

The three questions judges will ask

Rehearse one-sentence answers:

"Could the LLM ever make a red check go green?" → "No. The verdict is all(exit_code == expected). Here's the file — no model call in it. The LLM only summarises failures for the next planner attempt, and we label that advisory."
"What happens when it runs out of attempts?" → "It rolls back and then re-runs the suite to prove the workspace is green, and reports undelivered." (Show the post-rollback verification log. This is your differentiator.)
"Is the loop actually configurable?" → Click a node, change the model or max iterations, export the JSON, show the diff.
Do Not Do Yet
LangGraph, or any orchestration framework
Agent SDK in-process (CLI subprocess only)
Docker, worktrees, WebSockets, auth, a database beyond JSON files
Drag-to-connect graph editing
LLM-as-judge, coverage thresholds
Definition of Done for the contract meeting (next 30 minutes)

All four of you have the same workflow.json and run-state shape open, A has pushed a fake run, and B has confirmed claude -p works on their machine. Nobody writes a second line of feature code until those three are true.
