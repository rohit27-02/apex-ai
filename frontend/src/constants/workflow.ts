import type { Workflow } from '@/types/workflow';

export const DEFAULT_WORKFLOW: Workflow = {
  id: 'default-loop',
  name: 'Autonomous Coding Loop',
  maxAttempts: 3,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  nodes: [
    {
      id: 'input',
      type: 'input',
      name: 'Coding Objective',
      config: { objective: '', constraints: [] },
      position: { x: 50, y: 300 },
    },
    {
      id: 'criteria',
      type: 'agent',
      name: 'Success Criteria Agent',
      config: {
        role: 'criteria',
        model: 'claude-sonnet-4-20250514',
        instructions: 'Convert the engineering objective into measurable completion criteria.',
        tools: ['read_file', 'list_files'],
        // Hybrid mode: pre-confirmed, command-based criteria the backend's
        // deterministic validator executes (verdict = exit codes, no LLM).
        // These run against the target repo (NEXT_PUBLIC_TARGET_REPO).
        criteria: [
          {
            id: 'c1',
            description: 'All tests pass',
            command: 'python -m pytest -q',
            expect_exit_code: 0,
          },
          {
            id: 'c2',
            description: 'Todo store module still present',
            command: 'test -f app/todos.py',
            expect_exit_code: 0,
          },
        ],
      },
      position: { x: 350, y: 300 },
    },
    {
      id: 'planning',
      type: 'agent',
      name: 'Planning Agent',
      config: {
        model: 'claude-sonnet-4-20250514',
        instructions: 'Create a concrete implementation plan naming real files and modules.',
        tools: ['read_file', 'list_files', 'search'],
      },
      position: { x: 650, y: 300 },
    },
    {
      id: 'execution',
      type: 'agent',
      name: 'Execution Agent',
      config: {
        model: 'claude-sonnet-4-20250514',
        instructions: 'Implement the changes according to the plan.',
        tools: ['read_file', 'write_file', 'edit_file', 'run_command', 'search'],
      },
      position: { x: 950, y: 300 },
    },
    {
      id: 'validation',
      type: 'validator',
      name: 'Validation Agent',
      config: {
        criteria: [
          'Project builds successfully',
          'Existing tests pass',
          'No lint errors',
          'Type checking passes',
        ],
        retryLimit: 3,
      },
      position: { x: 1250, y: 300 },
    },
    {
      id: 'decision',
      type: 'decision',
      name: 'Pass / Fail?',
      config: { condition: 'all criteria passed' },
      position: { x: 1550, y: 300 },
    },
    {
      id: 'human-gate',
      type: 'human_gate',
      name: 'Human Approval',
      config: { prompt: 'Review changes and approve?', required: false },
      position: { x: 1550, y: 500 },
    },
    {
      id: 'success',
      type: 'success',
      name: 'Task Complete',
      config: { message: 'All criteria met. Task delivered.' },
      position: { x: 1850, y: 200 },
    },
    {
      id: 'stop',
      type: 'stop',
      name: 'Stopped Safely',
      config: { reason: 'Max attempts exhausted' },
      position: { x: 1850, y: 500 },
    },
  ],
  edges: [
    // Main flow — left to right
    { id: 'e-input-criteria', source: 'input', target: 'criteria', type: 'default' },
    { id: 'e-criteria-planning', source: 'criteria', target: 'planning', type: 'default' },
    { id: 'e-planning-execution', source: 'planning', target: 'execution', type: 'default' },
    { id: 'e-execution-validation', source: 'execution', target: 'validation', type: 'default' },
    { id: 'e-validation-decision', source: 'validation', target: 'decision', type: 'default' },
    // Decision outputs — the human-gate edge comes FIRST: the backend follows
    // the first matching edge, so a passing validation routes through review.
    { id: 'e-decision-human', source: 'decision', target: 'human-gate', label: 'review', type: 'default' },
    { id: 'e-decision-success', source: 'decision', target: 'success', label: 'pass', type: 'success' },
    // Fail loop-back — routes ABOVE the main flow using top handles
    { id: 'e-decision-planning', source: 'decision', sourceHandle: 'top-source', target: 'planning', targetHandle: 'top-target', label: 'fail', type: 'failure' },
    // Human gate outputs
    { id: 'e-human-success', source: 'human-gate', target: 'success', label: 'approved', type: 'success' },
    { id: 'e-human-stop', source: 'human-gate', target: 'stop', label: 'rejected', type: 'failure' },
  ],
};

export const NODE_LIBRARY_ITEMS = [
  { type: 'input' as const, label: 'Input' },
  { type: 'agent' as const, label: 'Agent' },
  { type: 'command' as const, label: 'Command' },
  { type: 'validator' as const, label: 'Validator' },
  { type: 'decision' as const, label: 'Decision' },
  { type: 'human_gate' as const, label: 'Human Gate' },
  { type: 'success' as const, label: 'Success' },
  { type: 'stop' as const, label: 'Stop' },
];
