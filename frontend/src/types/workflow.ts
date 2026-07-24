export type NodeType =
  | 'input'
  | 'agent'
  | 'command'
  | 'validator'
  | 'decision'
  | 'human_gate'
  | 'success'
  | 'stop';

export type NodeStatus = 'idle' | 'running' | 'success' | 'failure' | 'skipped' | 'waiting';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  name: string;
  config: Record<string, unknown>;
  position: { x: number; y: number };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
  type?: 'success' | 'failure' | 'default';
}

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  maxAttempts: number;
  createdAt: string;
  updatedAt: string;
}

export interface NodeConfig {
  input: { objective: string; constraints: string[] };
  agent: { model: string; instructions: string; tools: string[] };
  command: { command: string; timeout?: number };
  validator: { criteria: string[]; retryLimit: number };
  decision: { condition: string };
  human_gate: { prompt: string; required: boolean };
  success: { message: string };
  stop: { reason: string };
}

// ── Backend schema types (Person A's contract) ──

export interface BackendWorkflowNode {
  id: string;
  type: NodeType;
  config?: Record<string, unknown>;
}

export interface BackendWorkflowEdge {
  source: string;
  target: string;
  on: 'success' | 'failure';
}

export interface BackendWorkflow {
  entryNode: string;
  nodes: BackendWorkflowNode[];
  edges: BackendWorkflowEdge[];
}

export interface CreateRunRequest {
  workflow: BackendWorkflow;
  objective: string;
  maxAttempts: number;
}
