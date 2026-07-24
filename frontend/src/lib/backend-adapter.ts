/**
 * Backend adapter — translates the orchestrator API's RunState (snake_case,
 * backend enums) into the frontend's Run shape (camelCase, UI enums).
 *
 * This is the ONLY place the two dialects meet. The backend contract is frozen
 * (backend/contracts/run_state.schema.json); the UI types are Person C's.
 */

import type { Run, RunEvent, RunEventKind, CriteriaItem, NodeRunState } from '@/types/run';

// ── Backend wire shapes (what GET /runs/{id} actually returns) ──

export interface BackendNodeState {
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  started_at?: string | null;
  ended_at?: string | null;
  result_summary?: string | null;
}

export interface BackendEvent {
  timestamp: string;
  node_id: string;
  type: string;
  payload: Record<string, unknown>;
}

export interface BackendCriterion {
  id: string;
  description: string;
  command: string;
  expect_exit_code: number;
  status: 'pending' | 'passed' | 'failed';
  exit_code?: number | null;
  evidence?: string;
}

export interface BackendRunState {
  run_id: string;
  status:
    | 'created'
    | 'running'
    | 'awaiting_approval'
    | 'success'
    | 'failed'
    | 'stopped_safely'
    | 'rolled_back';
  attempt: number;
  max_attempts: number;
  objective: string;
  started_at: string;
  updated_at: string;
  delivered: boolean;
  cost?: { model_calls: number; seconds: number };
  node_states: Record<string, BackendNodeState>;
  events: BackendEvent[];
  criteria: BackendCriterion[];
}

// ── Status maps ──

const RUN_STATUS_MAP: Record<BackendRunState['status'], Run['status']> = {
  created: 'running', // launched, first poll may land before the loop starts
  running: 'running',
  awaiting_approval: 'running', // gate surfaces via nodeStates 'waiting'
  success: 'success',
  failed: 'failure',
  stopped_safely: 'stopped',
  rolled_back: 'stopped',
};

const NODE_STATUS_MAP: Record<BackendNodeState['status'], NodeRunState['status']> = {
  pending: 'idle',
  running: 'running',
  success: 'success',
  failed: 'failure',
  skipped: 'skipped',
};

// ── Event translation ──

const EVENT_KIND_MAP: Record<string, RunEventKind> = {
  run_started: 'agent_message',
  node_started: 'agent_message',
  node_finished: 'agent_message',
  agent_invoked: 'agent_message',
  command_executed: 'command',
  files_changed: 'file_change',
  validation_started: 'validation',
  criterion_passed: 'validation',
  criterion_failed: 'error',
  retry_triggered: 'retry',
  rollback_started: 'agent_message',
  rollback_completed: 'agent_message',
  post_rollback_verification_passed: 'validation',
  post_rollback_verification_failed: 'error',
  human_gate_awaiting: 'human_feedback',
  human_gate_approved: 'human_feedback',
  human_gate_rejected: 'human_feedback',
  human_feedback: 'human_feedback',
  run_stopped_safely: 'agent_message',
  run_succeeded: 'agent_message',
};

function eventMessage(e: BackendEvent): string {
  const p = e.payload ?? {};
  switch (e.type) {
    case 'run_started':
      return `Run started: ${p.objective ?? ''}`;
    case 'node_started':
      return `Node started (attempt ${p.attempt ?? '?'})`;
    case 'node_finished':
      return `Node finished`;
    case 'agent_invoked':
      return `Agent invoked: ${p.role ?? e.node_id} (attempt ${p.attempt ?? '?'})`;
    case 'command_executed':
      return `Command: ${p.command ?? ''} → exit ${p.exit_code ?? '?'}`;
    case 'files_changed':
      return `Files changed: ${((p.files as string[]) ?? []).join(', ') || 'none'}`;
    case 'validation_started':
      return `Validation started (attempt ${p.attempt ?? '?'})`;
    case 'criterion_passed':
      return `Criterion passed: ${p.criterion ?? ''} (exit ${p.exit_code ?? 0})`;
    case 'criterion_failed':
      return `Criterion FAILED: ${p.criterion ?? ''} (exit ${p.exit_code}, expected ${p.expected})`;
    case 'retry_triggered':
      return `Retry → attempt ${p.attempt ?? '?'}: ${p.reason ?? ''}`;
    case 'rollback_started':
      return `Rolling back to base ref ${String(p.base_ref ?? '').slice(0, 8) || '(none)'}`;
    case 'rollback_completed':
      return p.performed ? 'Rollback completed' : 'Rollback skipped (no git baseline)';
    case 'post_rollback_verification_passed':
      return 'Post-rollback verification: workspace is GREEN';
    case 'post_rollback_verification_failed':
      return 'Post-rollback verification FAILED';
    case 'human_gate_awaiting':
      return 'Awaiting human approval...';
    case 'human_gate_approved':
      return p.auto ? 'Human gate auto-approved' : 'Approved by reviewer';
    case 'human_gate_rejected':
      return 'Rejected by reviewer — stopping safely';
    case 'human_feedback':
      return `Reviewer feedback: ${p.feedback ?? ''}`;
    case 'run_stopped_safely':
      return `Run stopped safely: ${p.reason ?? ''} (delivered: false)`;
    case 'run_succeeded':
      return `Task successful — delivered on attempt ${p.attempt ?? '?'}`;
    default:
      return e.type;
  }
}

function eventDetail(e: BackendEvent): string | undefined {
  const evidence = e.payload?.evidence;
  if (typeof evidence === 'string' && evidence.trim()) return evidence;
  const keys = Object.keys(e.payload ?? {});
  if (keys.length === 0) return undefined;
  return JSON.stringify(e.payload);
}

// ── Criteria translation ──

function criterionType(command: string): CriteriaItem['type'] {
  const c = command.toLowerCase();
  if (c.includes('coverage')) return 'coverage';
  if (c.includes('pytest') || c.includes('jest') || /\btest\b/.test(c)) return 'test';
  if (c.includes('ruff') || c.includes('lint') || c.includes('eslint')) return 'lint';
  if (c.includes('build') || c.includes('compile') || c.includes('tsc')) return 'build';
  return 'custom';
}

// ── Main translation ──

export function backendRunToRun(b: BackendRunState): Run {
  const isTerminal =
    b.status === 'success' ||
    b.status === 'failed' ||
    b.status === 'stopped_safely' ||
    b.status === 'rolled_back';

  const nodeStates: Record<string, NodeRunState> = {};
  for (const [id, ns] of Object.entries(b.node_states ?? {})) {
    // A node still 'running' while the run is paused is the waiting human gate.
    const waiting = b.status === 'awaiting_approval' && ns.status === 'running';
    nodeStates[id] = {
      status: waiting ? 'waiting' : NODE_STATUS_MAP[ns.status] ?? 'idle',
      output: ns.result_summary ?? undefined,
      error: ns.status === 'failed' ? ns.result_summary ?? 'failed' : undefined,
      startedAt: ns.started_at ?? undefined,
      completedAt: ns.ended_at ?? undefined,
    };
  }

  const events: RunEvent[] = (b.events ?? []).map((e, i) => ({
    id: `evt-${i}`,
    timestamp: e.timestamp,
    nodeId: e.node_id,
    type: EVENT_KIND_MAP[e.type] ?? 'agent_message',
    message: eventMessage(e),
    detail: eventDetail(e),
  }));

  const criteria: CriteriaItem[] = (b.criteria ?? []).map((c) => ({
    id: c.id,
    label: c.description,
    type: criterionType(c.command),
    status: c.status,
    evidence: c.evidence || (c.exit_code != null ? `exit ${c.exit_code} (${c.command})` : undefined),
  }));

  return {
    id: b.run_id,
    status: RUN_STATUS_MAP[b.status] ?? 'running',
    attempt: b.attempt,
    maxAttempts: b.max_attempts,
    objective: b.objective,
    criteria,
    events,
    nodeStates,
    startedAt: b.started_at,
    completedAt: isTerminal ? b.updated_at : undefined,
  };
}
