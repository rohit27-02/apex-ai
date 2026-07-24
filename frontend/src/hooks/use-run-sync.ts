'use client';

import { useRunPolling } from '@/lib/polling';
import { useWorkflowStore } from '@/stores/workflow-store';
import { useEffect, useRef } from 'react';
import type { NodeStatus } from '@/types/workflow';
import type { NodeRunState } from '@/types/run';

export function useRunSync(runId: string | null) {
  const { data: run, isLoading, error } = useRunPolling(runId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const prevRunRef = useRef<string | null>(null);

  // Sync node statuses from run state onto ReactFlow nodes
  useEffect(() => {
    if (!run) return;
    if (prevRunRef.current === run.id + run.attempt) return;
    prevRunRef.current = run.id + run.attempt;

    const nodeStates = run.nodeStates as Record<string, NodeRunState>;

    const updatedNodes = nodes.map((n) => {
      const nodeState = nodeStates[n.id];
      return {
        ...n,
        data: {
          ...n.data,
          status: (nodeState?.status ?? 'idle') as NodeStatus,
        },
      };
    });

    useWorkflowStore.setState({ nodes: updatedNodes });
  }, [run, nodes]);

  return { run, isLoading, error };
}
