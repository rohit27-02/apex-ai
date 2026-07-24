'use client';

import React from 'react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

export function ValidatorFields({ nodeId }: { nodeId: string }) {
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateConfig = useWorkflowStore((s) => s.updateNodeConfig);

  if (!node) return null;

  const config = node.data.config as Record<string, unknown>;
  const criteria = (config.criteria as string[]) ?? [];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={`${nodeId}-criteria`}>Criteria</Label>
        <Textarea
          id={`${nodeId}-criteria`}
          value={criteria.join('\n')}
          onChange={(e) =>
            updateConfig(nodeId, { ...config, criteria: e.target.value.split('\n').filter(Boolean) })
          }
          className="min-h-[100px] resize-none"
          placeholder="One criterion per line..."
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${nodeId}-retry`}>Retry Limit</Label>
        <Input
          id={`${nodeId}-retry`}
          type="number"
          min={1}
          max={10}
          value={(config.retryLimit as number) ?? 3}
          onChange={(e) => updateConfig(nodeId, { ...config, retryLimit: Number(e.target.value) })}
        />
      </div>
    </div>
  );
}
