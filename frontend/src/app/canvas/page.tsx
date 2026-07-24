'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TopBar } from '@/components/topbar/top-bar';
import { NodeLibrary } from '@/components/canvas/node-library';
import { WorkflowCanvas } from '@/components/canvas/workflow-canvas';
import { InspectorPanel } from '@/components/inspector/inspector-panel';
import { RunConsole } from '@/components/console/run-console';
import { NodeDetailPopup } from '@/components/canvas/node-detail-popup';
import { createRun, stopRun, checkBackend, approveRun, rejectRun } from '@/lib/api';
import { startDemoRun, stopDemoRun, approveDemoGate, rejectDemoGate } from '@/lib/demo-runner';
import type { RunScenario } from '@/lib/demo-runner';
import { useWorkflowStore } from '@/stores/workflow-store';
import { useRunPolling } from '@/lib/polling';
import type { Run, NodeRunState } from '@/types/run';
import type { NodeStatus } from '@/types/workflow';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function CanvasPageInner() {
  const [runId, setRunId] = useState<string | null>(null);
  const [demoRun, setDemoRun] = useState<Run | null>(null);
  const [useDemo, setUseDemo] = useState<boolean | null>(null); // null = checking
  const nodes = useWorkflowStore((s) => s.nodes);

  // Poll real backend if available
  const { data: polledRun } = useRunPolling(runId);

  // Determine which run to display
  const run = runId ? polledRun ?? null : demoRun;

  // Check backend availability on mount
  useEffect(() => {
    checkBackend().then((available) => setUseDemo(!available));
  }, []);

  // Sync node statuses and output/error from run state onto ReactFlow nodes
  useEffect(() => {
    if (!run) return;

    const nodeStates = run.nodeStates as Record<string, NodeRunState>;
    const updatedNodes = nodes.map((n) => {
      const nodeState = nodeStates[n.id];
      return {
        ...n,
        data: {
          ...n.data,
          status: (nodeState?.status ?? 'idle') as NodeStatus,
          output: nodeState?.output ?? null,
          error: nodeState?.error ?? null,
        },
      };
    });
    useWorkflowStore.setState({ nodes: updatedNodes });
  }, [run]);

  // ── Run controls ──

  const handleStart = useCallback(async (objective: string, scenario?: RunScenario) => {
    if (useDemo === false) {
      // Real backend
      try {
        const workflow = useWorkflowStore.getState().workflow;
        const newRun = await createRun(workflow, objective);
        setRunId(newRun.id);
      } catch (err) {
        console.error('Failed to create run:', err);
        // Fall back to demo
        const newRun = startDemoRun((updatedRun) => {
          setDemoRun({ ...updatedRun });
        }, { scenario });
        setDemoRun(newRun);
      }
    } else {
      // Demo mode
      const newRun = startDemoRun((updatedRun) => {
        setDemoRun({ ...updatedRun });
      }, { scenario });
      setDemoRun(newRun);
    }
  }, [useDemo]);

  const handleStop = useCallback(async () => {
    if (runId) {
      try {
        await stopRun(runId);
      } catch (err) {
        console.error('Failed to stop run:', err);
      }
      setRunId(null);
    } else {
      stopDemoRun();
      setDemoRun((prev) => prev ? { ...prev, status: 'stopped', completedAt: new Date().toISOString() } : null);
    }
    // Reset node statuses
    const currentNodes = useWorkflowStore.getState().nodes;
    const resetNodes = currentNodes.map((n) => ({
      ...n,
      data: { ...n.data, status: 'idle' as NodeStatus, output: null, error: null },
    }));
    useWorkflowStore.setState({ nodes: resetNodes });
  }, [runId]);

  // ── Human gate ──

  const handleApprove = useCallback(async (nodeId: string, feedback?: string) => {
    if (runId) {
      await approveRun(runId, nodeId, feedback);
    } else if (demoRun) {
      approveDemoGate();
    }
  }, [runId, demoRun]);

  const handleReject = useCallback(async (nodeId: string, feedback?: string) => {
    if (runId) {
      await rejectRun(runId, nodeId, feedback);
    } else if (demoRun) {
      rejectDemoGate();
    }
  }, [runId, demoRun]);

  // Check if any human gate is waiting
  const waitingGate = run?.nodeStates
    ? Object.entries(run.nodeStates).find(([id, state]) => {
        const node = nodes.find((n) => n.id === id);
        return state.status === 'waiting' && node?.data.nodeType === 'human_gate';
      })
    : null;

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--background)', color: 'var(--foreground)' }}>
      <a href="#main-canvas" className="sr-only sr-only-focusable">
        Skip to canvas
      </a>

      <TopBar
        run={run}
        onStart={handleStart}
        onStop={handleStop}
        backendAvailable={useDemo === false}
      />

      <div className="flex-1 flex overflow-hidden">
        <NodeLibrary />

        <main id="main-canvas" className="flex-1 flex flex-col overflow-hidden" role="main" aria-label="Workflow canvas area">
          <div className="flex-1 relative">
            <WorkflowCanvas
              run={run}
              waitingGateNodeId={waitingGate?.[0] ?? null}
              onApproveGate={handleApprove}
              onRejectGate={handleReject}
            />
          </div>
          <RunConsole events={run?.events ?? []} />
        </main>

        <InspectorPanel
          run={run}
          waitingGateNodeId={waitingGate?.[0] ?? null}
          onApproveGate={handleApprove}
          onRejectGate={handleReject}
        />
      </div>

      {/* Node detail popup */}
      <NodeDetailPopup />
    </div>
  );
}

export default function CanvasPage() {
  return (
    <QueryClientProvider client={queryClient}>
      <CanvasPageInner />
    </QueryClientProvider>
  );
}
