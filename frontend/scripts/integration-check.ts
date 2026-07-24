/**
 * Full-stack integration check — runs the REAL frontend seam code against a
 * live backend, exactly as the UI does (minus React):
 *
 *   DEFAULT_WORKFLOW -> toBackendWorkflow -> POST /runs
 *   poll GET /runs/{id} -> backendRunToRun -> RunSchema.parse (zod)
 *   waiting human gate detected -> POST /approve -> success + delivered
 *
 * Run:  node scripts/integration-check.ts   (backend on :8000)
 */

import { DEFAULT_WORKFLOW } from '../src/constants/workflow.ts';
import { toBackendWorkflow } from '../src/lib/workflow-adapter.ts';
import { backendRunToRun, type BackendRunState } from '../src/lib/backend-adapter.ts';
import { RunSchema } from '../src/lib/validation.ts';

const API = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

function fail(msg: string): never {
  console.error(`✗ FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg: string) {
  console.log(`✓ ${msg}`);
}

async function main() {
  // 1. Health — the same probe the UI uses to leave demo mode
  const health = await fetch(`${API}/health`);
  if (!health.ok) fail(`/health returned ${health.status}`);
  ok('backend healthy — UI would select REAL mode');

  // 2. Create a run from the UI's actual default workflow
  const workflow = toBackendWorkflow(DEFAULT_WORKFLOW);
  if (workflow.entryNode !== 'input') fail(`entry node ${workflow.entryNode}, expected 'input'`);
  const createRes = await fetch(`${API}/runs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow,
      objective: 'Integration check: add error handling to the API layer',
      maxAttempts: 3,
      auto_approve: false,
      runner: 'stub',
      repo_path: '',
    }),
  });
  if (!createRes.ok) fail(`POST /runs -> ${createRes.status}: ${await createRes.text()}`);
  const created = (await createRes.json()) as BackendRunState;
  ok(`run created: ${created.run_id}`);

  // 3. Poll + translate + zod-validate every state, like useRunPolling does
  let backendState: BackendRunState = created;
  for (let i = 0; i < 60; i++) {
    backendState = (await (await fetch(`${API}/runs/${created.run_id}`)).json()) as BackendRunState;
    RunSchema.parse(backendRunToRun(backendState)); // throws if the seam is wrong
    if (backendState.status !== 'running' && backendState.status !== 'created') break;
    await new Promise((r) => setTimeout(r, 250));
  }
  ok('every polled state passed RunSchema.parse');

  // 4. The run must be paused at the human gate, surfaced as 'waiting'
  if (backendState.status !== 'awaiting_approval')
    fail(`expected awaiting_approval, got ${backendState.status}`);
  const paused = RunSchema.parse(backendRunToRun(backendState));
  if (paused.status !== 'running') fail(`paused run maps to '${paused.status}', UI needs 'running'`);
  if (paused.nodeStates['human-gate']?.status !== 'waiting')
    fail(`human-gate state is '${paused.nodeStates['human-gate']?.status}', expected 'waiting'`);
  ok("human gate paused and mapped to 'waiting' — approve/reject UI would show");

  // 5. Approve, as the UI's approveRun() does
  const approveRes = await fetch(`${API}/runs/${created.run_id}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved: true, feedback: 'integration check LGTM' }),
  });
  if (!approveRes.ok) fail(`approve -> ${approveRes.status}`);

  // 6. Final state: success + delivered, criteria green, receipts present
  const finalBackend = (await (await fetch(`${API}/runs/${created.run_id}`)).json()) as BackendRunState;
  const finalRun = RunSchema.parse(backendRunToRun(finalBackend));
  if (finalRun.status !== 'success') fail(`final status ${finalRun.status}`);
  if (!finalBackend.delivered) fail('backend did not mark delivered');
  if (!finalRun.criteria.every((c) => c.status === 'passed'))
    fail(`criteria not all passed: ${JSON.stringify(finalRun.criteria)}`);
  if (finalRun.events.length < 10) fail(`only ${finalRun.events.length} events`);
  if (!finalRun.completedAt) fail('completedAt missing on terminal run');
  ok(`final: status=${finalRun.status}, criteria ${finalRun.criteria.length}/`
    + `${finalRun.criteria.length} passed, ${finalRun.events.length} events, `
    + `attempt ${finalRun.attempt}/${finalRun.maxAttempts}`);

  console.log('\nINTEGRATION CHECK PASSED — frontend seam and backend agree.');
}

main().catch((e) => fail(String(e)));
