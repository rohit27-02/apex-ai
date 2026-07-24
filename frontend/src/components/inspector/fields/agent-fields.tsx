'use client';

import React from 'react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const AVAILABLE_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-3-5-sonnet-20241022',
  'gpt-4o',
  'gpt-4o-mini',
  'gemini-2.0-flash',
];

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

  if (!node) return null;

  const config = node.data.config as Record<string, unknown>;
  const tools = (config.tools as string[]) ?? [];

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Label>Model</Label>
        <Select
          value={(config.model as string) ?? ''}
          onValueChange={(value: string) => updateConfig(nodeId, { ...config, model: value })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select model..." />
          </SelectTrigger>
          <SelectContent>
            {AVAILABLE_MODELS.map((m) => (
              <SelectItem key={m} value={m}>{m}</SelectItem>
            ))}
          </SelectContent>
        </Select>
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
