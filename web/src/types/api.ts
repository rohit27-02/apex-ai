import type { Run } from './run';
import type { Workflow } from './workflow';

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: string;
}

export type RunResponse = ApiResponse<Run>;
export type WorkflowResponse = ApiResponse<Workflow>;
