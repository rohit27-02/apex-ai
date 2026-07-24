import type { Run, RunEvent, NodeRunState } from '@/types/run';

export type RunScenario = 'success' | 'failure' | 'human_gate';

interface DemoRunOptions {
  scenario?: RunScenario;
}

// ── Node execution order ──

const DEMO_NODE_ORDER = ['input', 'criteria', 'planning', 'execution', 'validation', 'decision'];

// ── Output map: populated when each node completes ──

const NODE_OUTPUT_MAP: Record<string, string> = {
  input: 'Objective parsed and validated',
  criteria: '4 success criteria defined: build, test, lint, typecheck',
  planning: 'Implementation plan: modify 3 files across api/ module',
  execution: 'Applied changes: +91 -20 lines across 3 files',
  validation: 'All 4 criteria passed',
  decision: 'All criteria met',
  'human-gate': 'Approved by reviewer',
};

// ── Scenario: Success (with human gate) ──

const SUCCESS_EVENTS: Omit<RunEvent, 'id' | 'timestamp'>[] = [
  { nodeId: 'input', type: 'agent_message', message: 'Objective received: Add error handling to API layer' },
  { nodeId: 'criteria', type: 'agent_message', message: 'Analyzing codebase structure...' },
  { nodeId: 'criteria', type: 'command', message: 'Reading project configuration', detail: 'package.json, tsconfig.json' },
  { nodeId: 'criteria', type: 'agent_message', message: 'Generating success criteria based on project conventions' },
  { nodeId: 'criteria', type: 'validation', message: 'Criteria generated: 4 items defined' },
  { nodeId: 'planning', type: 'agent_message', message: 'Creating implementation plan...' },
  { nodeId: 'planning', type: 'command', message: 'Searching for existing patterns', detail: 'grep -r "try/catch" src/' },
  { nodeId: 'planning', type: 'file_change', message: 'Plan created: 3 files to modify', detail: 'src/api/handler.ts, src/api/middleware.ts, src/api/routes.ts' },
  { nodeId: 'execution', type: 'agent_message', message: 'Starting implementation...' },
  { nodeId: 'execution', type: 'file_change', message: 'Modified src/api/handler.ts', detail: '+45 -12 lines' },
  { nodeId: 'execution', type: 'file_change', message: 'Modified src/api/middleware.ts', detail: '+28 -5 lines' },
  { nodeId: 'execution', type: 'file_change', message: 'Modified src/api/routes.ts', detail: '+18 -3 lines' },
  { nodeId: 'execution', type: 'command', message: 'Running build check', detail: 'npm run build' },
  { nodeId: 'validation', type: 'validation', message: 'Checking: Project builds successfully', detail: 'PASS' },
  { nodeId: 'validation', type: 'validation', message: 'Checking: Existing tests pass', detail: 'PASS (14/14)' },
  { nodeId: 'validation', type: 'validation', message: 'Checking: No lint errors', detail: 'PASS' },
  { nodeId: 'validation', type: 'validation', message: 'Checking: Type checking passes', detail: 'PASS' },
  { nodeId: 'decision', type: 'agent_message', message: 'All criteria met — routing to human review' },
  { nodeId: 'human-gate', type: 'human_feedback', message: 'Awaiting human approval...' },
];

// ── Scenario: Failure (validation fails after retries, then stops) ──

const FAILURE_EVENTS: Omit<RunEvent, 'id' | 'timestamp'>[] = [
  { nodeId: 'input', type: 'agent_message', message: 'Objective received: Add error handling to API layer' },
  { nodeId: 'criteria', type: 'agent_message', message: 'Analyzing codebase structure...' },
  { nodeId: 'criteria', type: 'command', message: 'Reading project configuration', detail: 'package.json, tsconfig.json' },
  { nodeId: 'criteria', type: 'agent_message', message: 'Generating success criteria based on project conventions' },
  { nodeId: 'criteria', type: 'validation', message: 'Criteria generated: 4 items defined' },
  { nodeId: 'planning', type: 'agent_message', message: 'Creating implementation plan...' },
  { nodeId: 'planning', type: 'command', message: 'Searching for existing patterns', detail: 'grep -r "try/catch" src/' },
  { nodeId: 'planning', type: 'file_change', message: 'Plan created: 3 files to modify', detail: 'src/api/handler.ts, src/api/middleware.ts, src/api/routes.ts' },
  { nodeId: 'execution', type: 'agent_message', message: 'Starting implementation...' },
  { nodeId: 'execution', type: 'file_change', message: 'Modified src/api/handler.ts', detail: '+45 -12 lines' },
  { nodeId: 'execution', type: 'file_change', message: 'Modified src/api/middleware.ts', detail: '+28 -5 lines' },
  { nodeId: 'execution', type: 'file_change', message: 'Modified src/api/routes.ts', detail: '+18 -3 lines' },
  { nodeId: 'execution', type: 'command', message: 'Running build check', detail: 'npm run build' },
  // Validation attempt 1 — failure
  { nodeId: 'validation', type: 'validation', message: 'Checking: Project builds successfully', detail: 'PASS' },
  { nodeId: 'validation', type: 'validation', message: 'Checking: Existing tests pass', detail: 'PASS (12/14)' },
  { nodeId: 'validation', type: 'error', message: 'Lint errors found in src/api/handler.ts', detail: 'error: Unexpected any type @typescript-eslint/no-explicit-any' },
  { nodeId: 'validation', type: 'retry', message: 'Retry 1/3: Re-running validation after lint fix' },
  // Validation attempt 2 — another failure
  { nodeId: 'validation', type: 'validation', message: 'Checking: No lint errors', detail: 'PASS' },
  { nodeId: 'validation', type: 'error', message: 'Type check failed in src/api/middleware.ts', detail: 'error TS2345: Argument of type string is not assignable to parameter of type Request' },
  { nodeId: 'validation', type: 'retry', message: 'Retry 2/3: Re-running after type fix' },
  // Validation attempt 3 — final failure
  { nodeId: 'validation', type: 'error', message: 'Build failed after retries', detail: 'error TS2339: Property x does not exist on type y' },
  { nodeId: 'validation', type: 'retry', message: 'Retry 3/3: Final attempt' },
  { nodeId: 'validation', type: 'error', message: 'Max retries exceeded — validation failed', detail: '3/3 retries exhausted' },
  // Decision — stop
  { nodeId: 'decision', type: 'agent_message', message: 'Criteria not met after max retries — stopping workflow' },
];

// ── Scenario: Human Gate (waits for approval, then completes) ──

const HUMAN_GATE_EVENTS: Omit<RunEvent, 'id' | 'timestamp'>[] = [
  { nodeId: 'input', type: 'agent_message', message: 'Objective received: Refactor authentication module' },
  { nodeId: 'criteria', type: 'agent_message', message: 'Analyzing codebase structure...' },
  { nodeId: 'criteria', type: 'command', message: 'Reading auth module', detail: 'src/auth/, src/middleware/auth.ts' },
  { nodeId: 'criteria', type: 'agent_message', message: 'Generating success criteria' },
  { nodeId: 'criteria', type: 'validation', message: 'Criteria generated: 3 items defined' },
  { nodeId: 'planning', type: 'agent_message', message: 'Creating refactoring plan...' },
  { nodeId: 'planning', type: 'command', message: 'Analyzing dependency graph', detail: '12 files depend on auth module' },
  { nodeId: 'planning', type: 'file_change', message: 'Plan created: 5 files to refactor', detail: 'src/auth/index.ts, src/auth/jwt.ts, src/auth/session.ts, src/middleware/auth.ts, src/api/routes.ts' },
  { nodeId: 'execution', type: 'agent_message', message: 'Starting refactoring...' },
  { nodeId: 'execution', type: 'file_change', message: 'Refactored src/auth/index.ts', detail: '+62 -34 lines' },
  { nodeId: 'execution', type: 'file_change', message: 'Refactored src/auth/jwt.ts', detail: '+41 -28 lines' },
  { nodeId: 'execution', type: 'file_change', message: 'Refactored src/auth/session.ts', detail: '+35 -19 lines' },
  { nodeId: 'execution', type: 'file_change', message: 'Updated src/middleware/auth.ts', detail: '+12 -8 lines' },
  { nodeId: 'execution', type: 'file_change', message: 'Updated src/api/routes.ts', detail: '+8 -4 lines' },
  { nodeId: 'execution', type: 'command', message: 'Running build check', detail: 'npm run build' },
  { nodeId: 'validation', type: 'validation', message: 'Checking: Project builds successfully', detail: 'PASS' },
  { nodeId: 'validation', type: 'validation', message: 'Checking: Existing tests pass', detail: 'PASS (22/22)' },
  { nodeId: 'validation', type: 'validation', message: 'Checking: No lint errors', detail: 'PASS' },
  { nodeId: 'validation', type: 'validation', message: 'Checking: Type checking passes', detail: 'PASS' },
  { nodeId: 'decision', type: 'agent_message', message: 'All criteria met — routing to human review' },
  { nodeId: 'human-gate', type: 'human_feedback', message: 'Awaiting human approval for refactoring changes...' },
];

// ── Scenario selector ──

function getEventsForScenario(scenario: RunScenario): Omit<RunEvent, 'id' | 'timestamp'>[] {
  switch (scenario) {
    case 'failure':
      return FAILURE_EVENTS;
    case 'human_gate':
      return HUMAN_GATE_EVENTS;
    case 'success':
    default:
      return SUCCESS_EVENTS;
  }
}

// ── Active demo state ──

interface DemoRunState {
  run: Run;
  events: Omit<RunEvent, 'id' | 'timestamp'>[];
  eventIndex: number;
  currentNodeIndex: number;
  timer: ReturnType<typeof setTimeout> | null;
  onUpdate: (run: Run) => void;
}

let activeDemo: DemoRunState | null = null;

// ── Public API ──

export function startDemoRun(
  onUpdate: (run: Run) => void,
  options?: DemoRunOptions,
): Run {
  stopDemoRun();

  const scenario = options?.scenario ?? 'success';
  const events = getEventsForScenario(scenario);

  // Determine which nodes are involved in this scenario
  const involvedNodes = [...new Set(events.map((e) => e.nodeId))];

  const now = new Date().toISOString();
  const run: Run = {
    id: `demo-${Date.now()}`,
    status: 'running',
    attempt: 1,
    maxAttempts: 3,
    objective: events[0]?.message ?? 'Demo objective',
    criteria: [
      { id: 'c1', label: 'Project builds successfully', type: 'build', status: 'pending' },
      { id: 'c2', label: 'Existing tests pass', type: 'test', status: 'pending' },
      { id: 'c3', label: 'No lint errors', type: 'lint', status: 'pending' },
      { id: 'c4', label: 'Type checking passes', type: 'custom', status: 'pending' },
    ],
    events: [],
    nodeStates: {},
    startedAt: now,
  };

  // Set all involved nodes to idle
  involvedNodes.forEach((id) => {
    run.nodeStates[id] = { status: 'idle' };
  });

  activeDemo = {
    run,
    events,
    eventIndex: 0,
    currentNodeIndex: 0,
    timer: null,
    onUpdate,
  };

  scheduleNextEvent();
  return run;
}

function scheduleNextEvent() {
  if (!activeDemo || activeDemo.eventIndex >= activeDemo.events.length) {
    finishDemo();
    return;
  }

  const event = activeDemo.events[activeDemo.eventIndex];
  const delay = 300 + Math.random() * 400;

  activeDemo.timer = setTimeout(() => {
    if (!activeDemo) return;

    const nodeIdx = activeDemo.events
      .slice(0, activeDemo.eventIndex + 1)
      .map((e) => e.nodeId)
      .lastIndexOf(event.nodeId);

    // Check if we're moving to a new node
    const involvedNodes = [...new Set(activeDemo.events.map((e) => e.nodeId))];
    const currentNodeInvolvedIdx = involvedNodes.indexOf(event.nodeId);
    const prevNodeIdx = activeDemo.currentNodeIndex;

    if (currentNodeInvolvedIdx >= 0 && currentNodeInvolvedIdx !== prevNodeIdx) {
      // Mark previous nodes as success (with output)
      for (let i = prevNodeIdx; i < currentNodeInvolvedIdx; i++) {
        const prevId = involvedNodes[i];
        if (prevId && activeDemo.run.nodeStates[prevId]?.status === 'running') {
          activeDemo.run.nodeStates[prevId] = {
            status: 'success',
            completedAt: new Date().toISOString(),
            output: NODE_OUTPUT_MAP[prevId] ?? 'Completed',
          };
        }
      }
      activeDemo.currentNodeIndex = currentNodeInvolvedIdx;

      // Set current node status
      if (event.nodeId === 'human-gate') {
        activeDemo.run.nodeStates[event.nodeId] = {
          status: 'waiting',
          startedAt: new Date().toISOString(),
        };
      } else {
        activeDemo.run.nodeStates[event.nodeId] = {
          status: 'running',
          startedAt: new Date().toISOString(),
        };
      }
    }

    // Handle error events — mark node as failure
    if (event.type === 'error') {
      activeDemo.run.nodeStates[event.nodeId] = {
        ...activeDemo.run.nodeStates[event.nodeId],
        status: 'failure',
        error: event.detail ?? event.message,
      };
    }

    // Handle retry events — mark node back to running
    if (event.type === 'retry') {
      activeDemo.run.nodeStates[event.nodeId] = {
        ...activeDemo.run.nodeStates[event.nodeId],
        status: 'running',
        error: undefined,
      };
    }

    // Add the event
    const fullEvent: RunEvent = {
      id: `evt-${Date.now()}-${activeDemo.eventIndex}`,
      timestamp: new Date().toISOString(),
      ...event,
    };
    activeDemo.run.events.push(fullEvent);

    // Update criteria based on validation events
    if (event.type === 'validation' && event.detail?.startsWith('PASS')) {
      const pending = activeDemo.run.criteria.find((c) => c.status === 'pending');
      if (pending) {
        pending.status = 'passed';
        pending.evidence = event.message;
      }
    }

    activeDemo.onUpdate({ ...activeDemo.run });
    activeDemo.eventIndex++;

    scheduleNextEvent();
  }, delay);
}

function finishDemo() {
  if (!activeDemo) return;

  const isFailure = activeDemo.run.nodeStates['validation']?.status === 'failure';

  if (isFailure) {
    activeDemo.run.status = 'failure';
  } else {
    activeDemo.run.status = 'success';
    activeDemo.run.criteria.forEach((c) => {
      if (c.status === 'pending') c.status = 'passed';
    });
  }

  activeDemo.run.completedAt = new Date().toISOString();

  // Mark remaining running nodes
  const involvedNodes = [...new Set(activeDemo.events.map((e) => e.nodeId))];
  involvedNodes.forEach((id) => {
    const state = activeDemo!.run.nodeStates[id];
    if (state?.status === 'running' || state?.status === 'waiting') {
      activeDemo!.run.nodeStates[id] = {
        status: isFailure ? 'failure' : 'success',
        completedAt: new Date().toISOString(),
        output: isFailure ? undefined : NODE_OUTPUT_MAP[id] ?? 'Completed',
        error: isFailure ? 'Validation failed after max retries' : undefined,
      };
    }
  });

  activeDemo.onUpdate({ ...activeDemo.run });
  activeDemo = null;
}

export function stopDemoRun() {
  if (activeDemo?.timer) {
    clearTimeout(activeDemo.timer);
  }
  if (activeDemo) {
    activeDemo.run.status = 'stopped';
    activeDemo.run.completedAt = new Date().toISOString();
    activeDemo.onUpdate({ ...activeDemo.run });
  }
  activeDemo = null;
}

export function approveDemoGate(): void {
  if (!activeDemo) return;

  const event: RunEvent = {
    id: `evt-${Date.now()}-approve`,
    timestamp: new Date().toISOString(),
    nodeId: 'human-gate',
    type: 'human_feedback',
    message: 'Human approved — changes verified',
  };
  activeDemo.run.events.push(event);
  activeDemo.run.nodeStates['human-gate'] = {
    status: 'success',
    completedAt: new Date().toISOString(),
    output: 'Approved by reviewer',
  };

  activeDemo.onUpdate({ ...activeDemo.run });

  // Finish the demo (human gate is the last node)
  finishDemo();
}

export function rejectDemoGate(): void {
  if (!activeDemo) return;

  const event: RunEvent = {
    id: `evt-${Date.now()}-reject`,
    timestamp: new Date().toISOString(),
    nodeId: 'human-gate',
    type: 'human_feedback',
    message: 'Human rejected — stopping workflow',
  };
  activeDemo.run.events.push(event);
  activeDemo.run.nodeStates['human-gate'] = {
    status: 'failure',
    completedAt: new Date().toISOString(),
    error: 'Rejected by reviewer',
  };
  activeDemo.run.status = 'stopped';
  activeDemo.run.completedAt = new Date().toISOString();

  activeDemo.onUpdate({ ...activeDemo.run });
  activeDemo = null;
}
