'use client';

import React, { useState, useCallback } from 'react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { useSettingsStore, PROVIDER_MODEL_OPTIONS, PROVIDER_MODELS, PROVIDER_LABELS, type Provider } from '@/stores/settings-store';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  AGENT_TEMPLATES,
  AGENT_TEMPLATE_OPTIONS,
  type AgentTemplate,
} from '@/constants/agent-templates';
import {
  FileText,
  Search,
  Terminal,
  GitBranch,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

// ── Tool groups ──

interface ToolGroup {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  tools: string[];
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    label: 'File System',
    icon: FileText,
    tools: ['read_file', 'write_file', 'edit_file', 'list_files'],
  },
  {
    label: 'Code Search',
    icon: Search,
    tools: ['search'],
  },
  {
    label: 'Shell',
    icon: Terminal,
    tools: ['run_command'],
  },
  {
    label: 'Git',
    icon: GitBranch,
    tools: ['git_diff', 'git_status'],
  },
];

// ── Component ──

export function AgentFields({ nodeId }: { nodeId: string }) {
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateConfig = useWorkflowStore((s) => s.updateNodeConfig);
  const updateNodeLabel = useWorkflowStore((s) => s.updateNodeLabel);
  const provider = useSettingsStore((s) => s.provider);
  const globalModel = useSettingsStore((s) => s.model);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  if (!node) return null;

  const config = node.data.config as Record<string, unknown>;
  const tools = (config.tools as string[]) ?? [];
  const currentModel = (config.model as string) ?? '';
  const currentTemplate = (config.template as AgentTemplate) ?? 'other';

  // Only show models for the currently selected provider
  const providerModels = PROVIDER_MODEL_OPTIONS[provider];
  // Include global model from settings if not already in the list
  const allOptions = globalModel && !providerModels.includes(globalModel)
    ? [globalModel, ...providerModels]
    : providerModels;
  // Keep an out-of-provider value visible so a previously-set model isn't lost
  const modelOptions = currentModel && !allOptions.includes(currentModel)
    ? [currentModel, ...allOptions]
    : allOptions;

  const handleTemplateChange = (template: AgentTemplate) => {
    const tpl = AGENT_TEMPLATES[template];
    const newConfig: Record<string, unknown> = {
      ...config,
      template,
      name: tpl.defaults.name,
      model: PROVIDER_MODELS[provider],
      instructions: tpl.defaults.instructions,
      tools: [...tpl.defaults.tools],
    };
    updateConfig(nodeId, newConfig);
    updateNodeLabel(nodeId, tpl.defaults.name);
  };

  const toggleGroup = (groupLabel: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupLabel)) next.delete(groupLabel);
      else next.add(groupLabel);
      return next;
    });
  };

  const toggleTool = useCallback(
    (tool: string) => {
      const next = tools.includes(tool)
        ? tools.filter((t) => t !== tool)
        : [...tools, tool];
      updateConfig(nodeId, { ...config, tools: next });
    },
    [nodeId, config, tools, updateConfig],
  );

  const toggleGroupTools = useCallback(
    (groupTools: string[]) => {
      const allActive = groupTools.every((t) => tools.includes(t));
      let next: string[];
      if (allActive) {
        next = tools.filter((t) => !groupTools.includes(t));
      } else {
        next = [...new Set([...tools, ...groupTools])];
      }
      updateConfig(nodeId, { ...config, tools: next });
    },
    [nodeId, config, tools, updateConfig],
  );

  return (
    <div className="space-y-5">
      {/* Template selector */}
      <div className="space-y-2">
        <Label>Type</Label>
        <Select
          value={currentTemplate}
          onValueChange={(val: string) => handleTemplateChange(val as AgentTemplate)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select type…" />
          </SelectTrigger>
          <SelectContent>
            {AGENT_TEMPLATE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Model selector — only current provider */}
      <div className="space-y-2">
        <Label>Model</Label>
        <Select
          value={currentModel}
          onValueChange={(val: string) => updateConfig(nodeId, { ...config, model: val })}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select model…" />
          </SelectTrigger>
          <SelectContent>
            {modelOptions.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[10px] text-muted-foreground/70">
          {PROVIDER_LABELS[provider]} models — change provider in Settings.
        </p>
      </div>

      {/* Instructions */}
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

      {/* Tools — grouped */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Tools {tools.length > 0 && <span className="text-muted-foreground font-normal">({tools.length} selected)</span>}
        </legend>
        <div className="space-y-1">
          {TOOL_GROUPS.map((group) => {
            const GroupIcon = group.icon;
            const activeCount = group.tools.filter((t) => tools.includes(t)).length;
            const allActive = activeCount === group.tools.length;
            const someActive = activeCount > 0 && !allActive;
            const isCollapsed = collapsedGroups.has(group.label);

            return (
              <div key={group.label} className="rounded-lg border border-border/50 overflow-hidden">
                {/* Group header */}
                <button
                  type="button"
                  onClick={() => toggleGroup(group.label)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2 text-xs font-medium transition-colors cursor-pointer',
                    someActive || allActive ? 'bg-primary/5' : 'hover:bg-muted/50',
                  )}
                >
                  {isCollapsed ? (
                    <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                  )}
                  <GroupIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 text-left text-muted-foreground">{group.label}</span>
                  <Badge
                    variant={allActive ? 'default' : someActive ? 'secondary' : 'outline'}
                    className="text-[10px] px-1.5 py-0 h-4"
                    role="checkbox"
                    aria-checked={allActive}
                    aria-label={`Select all ${group.label} tools`}
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      toggleGroupTools(group.tools);
                    }}
                  >
                    {activeCount}/{group.tools.length}
                  </Badge>
                </button>

                {/* Tool badges */}
                {!isCollapsed && (
                  <div className="px-3 pb-2 pt-1 flex flex-wrap gap-1.5">
                    {group.tools.map((tool) => {
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
                              : 'hover:bg-muted',
                          )}
                          onClick={() => toggleTool(tool)}
                        >
                          {tool}
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
