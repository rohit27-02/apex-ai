export type RunStatus = 'idle' | 'running' | 'success' | 'failure' | 'stopped';

export type RunEventKind =
  | 'agent_message'
  | 'command'
  | 'file_change'
  | 'validation'
  | 'error'
  | 'retry'
  | 'human_feedback';

export interface RunEvent {
  id: string;
  timestamp: string;
  nodeId: string;
  type: RunEventKind;
  message: string;
  detail?: string;
}

export interface CriteriaItem {
  id: string;
  label: string;
  type: 'build' | 'test' | 'lint' | 'coverage' | 'custom';
  status: 'pending' | 'passed' | 'failed';
  evidence?: string;
}

export interface NodeRunState {
  status: 'idle' | 'running' | 'success' | 'failure' | 'skipped' | 'waiting';
  output?: string;
  error?: string;
  logs?: string[];
  startedAt?: string;
  completedAt?: string;
}

export interface Run {
  id: string;
  status: RunStatus;
  attempt: number;
  maxAttempts: number;
  objective: string;
  criteria: CriteriaItem[];
  events: RunEvent[];
  nodeStates: Record<string, NodeRunState>;
  startedAt: string;
  completedAt?: string;
}
