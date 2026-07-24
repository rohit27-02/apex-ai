import { RunSchema, type ValidatedRun } from './validation';
import type { Workflow } from '@/types/workflow';
import { toBackendWorkflow } from './workflow-adapter';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? 'http://localhost:3001';

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
  const json = await res.json();
  return json.data ?? json;
}

// ── Run CRUD ──

export async function createRun(
  workflow: Workflow,
  objective: string,
  maxAttempts?: number
): Promise<ValidatedRun> {
  const backendWorkflow = toBackendWorkflow(workflow);
  const data = await request<{
    id: string;
    status: string;
    attempt: number;
    maxAttempts: number;
    objective: string;
    criteria: unknown[];
    events: unknown[];
    nodeStates: Record<string, unknown>;
    startedAt: string;
    completedAt?: string;
  }>('/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      workflow: backendWorkflow,
      objective,
      maxAttempts: maxAttempts ?? workflow.maxAttempts,
    }),
  });
  return RunSchema.parse(data);
}

export async function fetchRun(runId: string): Promise<ValidatedRun> {
  const data = await request<{
    id: string;
    status: string;
    attempt: number;
    maxAttempts: number;
    objective: string;
    criteria: unknown[];
    events: unknown[];
    nodeStates: Record<string, unknown>;
    startedAt: string;
    completedAt?: string;
  }>(`/runs/${runId}`);
  return RunSchema.parse(data);
}

export async function stopRun(runId: string): Promise<void> {
  await request(`/runs/${runId}/stop`, { method: 'POST' });
}

// ── Human Gate ──

export async function approveRun(
  runId: string,
  nodeId: string,
  feedback?: string
): Promise<void> {
  await request(`/runs/${runId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeId, feedback }),
  });
}

export async function rejectRun(
  runId: string,
  nodeId: string,
  feedback?: string
): Promise<void> {
  await request(`/runs/${runId}/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nodeId, feedback }),
  });
}

// ── Health check ──

export async function checkBackend(): Promise<boolean> {
  try {
    await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}
