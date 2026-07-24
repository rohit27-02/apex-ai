import { RunSchema, type ValidatedRun } from './validation';
import type { Workflow } from '@/types/workflow';
import { toBackendWorkflow } from './workflow-adapter';
import { backendRunToRun, type BackendRunState } from './backend-adapter';
import { getExecutionSettings } from '@/stores/settings-store';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:8000';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new ApiError(res.status, `API error ${res.status}: ${body}`);
  }
  return res.json();
}

/** Translate a backend RunState to the UI's Run shape, then validate it. */
function toValidatedRun(backendRun: BackendRunState): ValidatedRun {
  return RunSchema.parse(backendRunToRun(backendRun));
}

// ── Run CRUD ──

export async function createRun(
  workflow: Workflow,
  objective: string,
  maxAttempts?: number
): Promise<ValidatedRun> {
  const backendWorkflow = toBackendWorkflow(workflow);
  // BYOK: runner/model/key come from the frontend settings (env vars are
  // fallbacks so a headless setup still works).
  const { runner, model, apiKey } = getExecutionSettings();
  const data = await request<BackendRunState>('/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow: backendWorkflow,
      objective,
      maxAttempts: maxAttempts ?? workflow.maxAttempts,
      // Real human gate: pause the loop until the reviewer decides.
      auto_approve: false,
      runner: runner || process.env.NEXT_PUBLIC_RUNNER || 'stub',
      model: model || null,
      api_key: apiKey || null,
      repo_path: process.env.NEXT_PUBLIC_TARGET_REPO ?? '',
      green_command: process.env.NEXT_PUBLIC_GREEN_COMMAND ?? null,
    }),
  });
  return toValidatedRun(data);
}

export async function fetchRun(runId: string): Promise<ValidatedRun> {
  const data = await request<BackendRunState>(`/runs/${runId}`);
  return toValidatedRun(data);
}

export async function stopRun(runId: string): Promise<void> {
  await request(`/runs/${runId}/stop`, { method: 'POST' });
}

// ── Human Gate ──
// The backend exposes a single /approve endpoint taking an `approved` flag.
// nodeId is accepted for interface compatibility; the backend already knows
// which gate the run is paused at.

export async function approveRun(
  runId: string,
  _nodeId: string,
  feedback?: string
): Promise<void> {
  await request(`/runs/${runId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved: true, feedback: feedback ?? '' }),
  });
}

export async function rejectRun(
  runId: string,
  _nodeId: string,
  feedback?: string
): Promise<void> {
  await request(`/runs/${runId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved: false, feedback: feedback ?? '' }),
  });
}

// ── Health check ──

export async function checkBackend(): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return res.ok;
  } catch {
    return false;
  }
}
