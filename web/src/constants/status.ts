import type { NodeStatus } from '@/types/workflow';
import type { RunStatus } from '@/types/run';

export type AllStatus = NodeStatus | RunStatus;

export const STATUS_COLORS: Record<AllStatus, string> = {
  idle: 'bg-[var(--color-status-idle-bg)]',
  running: 'bg-[#E20074]',
  success: 'bg-green-500',
  failure: 'bg-red-500',
  stopped: 'bg-amber-500',
  skipped: 'bg-[var(--color-status-skipped-bg)]',
  waiting: 'bg-amber-500',
};

export const STATUS_TEXT_COLORS: Record<AllStatus, string> = {
  idle: 'text-[var(--color-status-idle-text)]',
  running: 'text-[var(--magenta)]',
  success: 'text-[var(--color-badge-success)]',
  failure: 'text-[var(--color-badge-danger)]',
  stopped: 'text-[var(--color-badge-warning)]',
  skipped: 'text-[var(--color-status-skipped-text)]',
  waiting: 'text-amber-400',
};

export const STATUS_LABELS: Record<AllStatus, string> = {
  idle: 'Idle',
  running: 'Running',
  success: 'Success',
  failure: 'Failed',
  stopped: 'Stopped',
  skipped: 'Skipped',
  waiting: 'Waiting',
};

export const STATUS_RING_COLORS: Record<AllStatus, string> = {
  idle: 'ring-[var(--color-status-idle-bg)]/30',
  running: 'ring-[#E20074]/30',
  success: 'ring-green-500/30',
  failure: 'ring-red-500/30',
  stopped: 'ring-amber-500/30',
  skipped: 'ring-[var(--color-status-skipped-bg)]/30',
  waiting: 'ring-amber-500/30',
};
