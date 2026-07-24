'use client';

import { useWorkflowStore } from '@/stores/workflow-store';

export function useWorkflow() {
  const workflow = useWorkflowStore((s) => s.workflow);
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const updateNodeConfig = useWorkflowStore((s) => s.updateNodeConfig);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);

  return {
    workflow,
    setWorkflow,
    updateNodeConfig,
    selectedNodeId,
  };
}
