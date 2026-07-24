'use client';

import React from 'react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

export function CommandFields({ nodeId }: { nodeId: string }) {
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateConfig = useWorkflowStore((s) => s.updateNodeConfig);

  if (!node) return null;

  const config = node.data.config as Record<string, unknown>;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={`${nodeId}-command`}>Command</Label>
        <Input
          id={`${nodeId}-command`}
          value={(config.command as string) ?? ''}
          onChange={(e) => updateConfig(nodeId, { ...config, command: e.target.value })}
          className="font-mono"
          placeholder="npm run build"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${nodeId}-timeout`}>Timeout (ms)</Label>
        <Input
          id={`${nodeId}-timeout`}
          type="number"
          value={(config.timeout as number) ?? 60000}
          onChange={(e) => updateConfig(nodeId, { ...config, timeout: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
