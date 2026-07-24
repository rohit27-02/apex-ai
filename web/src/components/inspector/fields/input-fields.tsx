'use client';

import React from 'react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

export function InputFields({ nodeId }: { nodeId: string }) {
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateConfig = useWorkflowStore((s) => s.updateNodeConfig);

  if (!node) return null;

  const config = node.data.config as Record<string, unknown>;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={`${nodeId}-objective`}>Objective</Label>
        <Textarea
          id={`${nodeId}-objective`}
          value={(config.objective as string) ?? ''}
          onChange={(e) => updateConfig(nodeId, { ...config, objective: e.target.value })}
          className="min-h-[100px] resize-none"
          placeholder="Describe the coding objective..."
          aria-describedby={`${nodeId}-objective-hint`}
        />
        <p id={`${nodeId}-objective-hint`} className="text-xs text-muted-foreground">
          What should the AI coding loop accomplish?
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor={`${nodeId}-constraints`}>Constraints</Label>
        <Textarea
          id={`${nodeId}-constraints`}
          value={((config.constraints as string[]) ?? []).join('\n')}
          onChange={(e) =>
            updateConfig(nodeId, { ...config, constraints: e.target.value.split('\n').filter(Boolean) })
          }
          className="min-h-[70px] resize-none"
          placeholder="One constraint per line..."
        />
      </div>
    </div>
  );
}
