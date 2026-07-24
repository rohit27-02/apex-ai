'use client';

import React from 'react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';

export function HumanGateFields({ nodeId }: { nodeId: string }) {
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateConfig = useWorkflowStore((s) => s.updateNodeConfig);

  if (!node) return null;

  const config = node.data.config as Record<string, unknown>;
  const isChecked = (config.required as boolean) ?? false;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={`${nodeId}-prompt`}>Approval Prompt</Label>
        <Textarea
          id={`${nodeId}-prompt`}
          value={(config.prompt as string) ?? ''}
          onChange={(e) => updateConfig(nodeId, { ...config, prompt: e.target.value })}
          className="min-h-[80px] resize-none"
          placeholder="Review changes and approve?"
        />
      </div>
      <div className="flex items-center justify-between">
        <Label htmlFor={`${nodeId}-required`} className="cursor-pointer">
          Required approval
        </Label>
        <Switch
          id={`${nodeId}-required`}
          checked={isChecked}
          onCheckedChange={(checked: boolean) => updateConfig(nodeId, { ...config, required: checked })}
          aria-label="Required approval toggle"
        />
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        Blocks workflow until approved
      </p>
    </div>
  );
}
