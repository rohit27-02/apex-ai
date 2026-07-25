import { z } from 'zod';

export const RunEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  nodeId: z.string(),
  type: z.enum([
    'agent_message',
    'command',
    'file_change',
    'validation',
    'error',
    'retry',
    'human_feedback',
  ]),
  message: z.string(),
  detail: z.string().optional(),
});

export const CriteriaItemSchema = z.object({
  id: z.string(),
  label: z.string(),
  type: z.enum(['build', 'test', 'lint', 'coverage', 'custom']),
  status: z.enum(['pending', 'passed', 'failed']),
  evidence: z.string().optional(),
});

export const TokenUsageSchema = z.object({
  input: z.number(),
  output: z.number(),
  total: z.number(),
});

export const NodeRunStateSchema = z.object({
  status: z.enum(['idle', 'running', 'success', 'failure', 'skipped', 'waiting']),
  output: z.string().optional(),
  error: z.string().optional(),
  logs: z.array(z.string()).optional(),
  startedAt: z.string().optional(),
  completedAt: z.string().optional(),
  tokenUsage: TokenUsageSchema.optional(),
  durationMs: z.number().optional(),
});

export const RunSchema = z.object({
  id: z.string(),
  status: z.enum(['idle', 'running', 'success', 'failure', 'stopped']),
  attempt: z.number(),
  maxAttempts: z.number(),
  objective: z.string(),
  criteria: z.array(CriteriaItemSchema),
  events: z.array(RunEventSchema),
  nodeStates: z.record(z.string(), NodeRunStateSchema),
  startedAt: z.string(),
  completedAt: z.string().optional(),
  totalTokenUsage: TokenUsageSchema.optional(),
  totalDurationMs: z.number().optional(),
});

export type ValidatedRun = z.infer<typeof RunSchema>;
