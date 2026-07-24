'use client';

import React from 'react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export function DecisionFields({ nodeId }: { nodeId: string }) {
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateConfig = useWorkflowStore((s) => s.updateNodeConfig);

  if (!node) return null;

  const config = node.data.config as Record<string, unknown>;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={`${nodeId}-condition`}>Condition</Label>
        <Input
          id={`${nodeId}-condition`}
          value={(config.condition as string) ?? ''}
          onChange={(e) => updateConfig(nodeId, { ...config, condition: e.target.value })}
          className="font-mono"
          placeholder="all criteria passed"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Defines the branching condition. Pass path on true, fail path on false.
      </p>
    </div>
  );
}
