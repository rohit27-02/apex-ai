'use client';

import React from 'react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { useSettingsStore, PROVIDER_MODEL_OPTIONS, PROVIDER_LABELS } from '@/stores/settings-store';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const AVAILABLE_TOOLS = [
  'read_file',
  'write_file',
  'edit_file',
  'run_command',
  'search',
  'list_files',
  'git_diff',
  'git_status',
];

export function AgentFields({ nodeId }: { nodeId: string }) {
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateConfig = useWorkflowStore((s) => s.updateNodeConfig);
  const provider = useSettingsStore((s) => s.provider);

  if (!node) return null;

  const config = node.data.config as Record<string, unknown>;
  const tools = (config.tools as string[]) ?? [];
  const models = PROVIDER_MODEL_OPTIONS[provider];
  const currentModel = (config.model as string) ?? '';
  // Keep an out-of-provider value visible so a previously-set model isn't lost.
  const modelOptions = currentModel && !models.includes(currentModel)
    ? [currentModel, ...models]
    : models;

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor={`${nodeId}-model`}>Model</Label>
        <select
          id={`${nodeId}-model`}
          value={currentModel}
          onChange={(e) => updateConfig(nodeId, { ...config, model: e.target.value })}
          className="w-full h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
        >
          <option value="" disabled>
            Select model…
          </option>
          {modelOptions.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <p className="text-[10px] text-muted-foreground/70">
          Models for {PROVIDER_LABELS[provider]} — change the provider in ⚙️ Settings.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${nodeId}-instructions`}>Instructions</Label>
        <Textarea
          id={`${nodeId}-instructions`}
          value={(config.instructions as string) ?? ''}
          onChange={(e) => updateConfig(nodeId, { ...config, instructions: e.target.value })}
          className="min-h-[120px] resize-none"
          placeholder="System instructions for this agent..."
        />
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Tools</legend>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Available tools">
          {AVAILABLE_TOOLS.map((tool) => {
            const isActive = tools.includes(tool);
            return (
              <Badge
                key={tool}
                variant={isActive ? 'default' : 'outline'}
                role="checkbox"
                aria-checked={isActive}
                aria-label={`${tool} tool`}
                className={cn(
                  'cursor-pointer select-none transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground hover:bg-primary/80'
                    : 'hover:bg-muted'
                )}
                onClick={() => {
                  const next = isActive
                    ? tools.filter((t) => t !== tool)
                    : [...tools, tool];
                  updateConfig(nodeId, { ...config, tools: next });
                }}
              >
                {tool}
              </Badge>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
