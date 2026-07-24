'use client';

import React, { useState } from 'react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const PROVIDER_MODELS: Record<string, { models: string[]; envKey: string; hint: string }> = {
  groq: {
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    envKey: 'GROQ_API_KEY',
    hint: 'gsk_...',
  },
  gemini: {
    models: ['gemini-3.5-flash', 'gemini-2.0-flash', 'gemini-2.5-flash'],
    envKey: 'GEMINI_API_KEY',
    hint: 'AIza...',
  },
  deepseek: {
    models: ['deepseek-chat', 'deepseek-coder'],
    envKey: 'DEEPSEEK_API_KEY',
    hint: 'sk-...',
  },
  openai: {
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    envKey: 'OPENAI_API_KEY',
    hint: 'sk-...',
  },
  ollama: {
    models: ['llama3.2', 'llama3.1', 'codellama'],
    envKey: '',
    hint: 'No key needed (local)',
  },
};

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

function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '****';
  return key.substring(0, 4) + '****' + key.substring(key.length - 4);
}

export function AgentFields({ nodeId }: { nodeId: string }) {
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateConfig = useWorkflowStore((s) => s.updateNodeConfig);
  const [showKey, setShowKey] = useState(false);

  if (!node) return null;

  const config = node.data.config as Record<string, unknown>;
  const tools = (config.tools as string[]) ?? [];
  const currentModel = (config.model as string) ?? '';
  const currentApiKey = (config.api_key as string) ?? '';

  // Parse provider from model string (e.g., "groq/llama-3.3-70b-versatile" → "groq")
  const modelParts = currentModel.split('/');
  const currentProvider = modelParts.length > 1 ? modelParts[0] : '';
  const currentModelName = modelParts.length > 1 ? modelParts[1] : currentModel;

  const providerInfo = currentProvider ? PROVIDER_MODELS[currentProvider] : null;

  const handleProviderChange = (provider: string) => {
    const info = PROVIDER_MODELS[provider];
    if (info) {
      const defaultModel = `${provider}/${info.models[0]}`;
      updateConfig(nodeId, {
        ...config,
        model: defaultModel,
        api_key: config.api_key || '',
        provider,
      });
    }
  };

  const handleModelChange = (modelName: string) => {
    const provider = currentProvider || 'groq';
    updateConfig(nodeId, {
      ...config,
      model: `${provider}/${modelName}`,
    });
  };

  return (
    <div className="space-y-5">
      {/* Provider Selection */}
      <div className="space-y-2">
        <Label>Provider</Label>
        <Select
          value={currentProvider}
          onValueChange={handleProviderChange}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select provider..." />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PROVIDER_MODELS).map(([key, info]) => (
              <SelectItem key={key} value={key}>
                {key.charAt(0).toUpperCase() + key.slice(1)}
                <span className="text-muted-foreground text-xs ml-2">
                  {info.hint}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Model Selection */}
      <div className="space-y-2">
        <Label>Model</Label>
        {providerInfo ? (
          <Select
            value={currentModelName}
            onValueChange={handleModelChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select model..." />
            </SelectTrigger>
            <SelectContent>
              {providerInfo.models.map((m) => (
                <SelectItem key={m} value={m}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Input
            value={currentModel}
            onChange={(e) => updateConfig(nodeId, { ...config, model: e.target.value })}
            placeholder="e.g., groq/llama-3.3-70b-versatile"
          />
        )}
        <p className="text-xs text-muted-foreground">
          Full model ID: {currentModel || 'not set'}
        </p>
      </div>

      {/* API Key */}
      {currentProvider && currentProvider !== 'ollama' && (
        <div className="space-y-2">
          <Label>API Key</Label>
          <div className="flex gap-2">
            <Input
              type={showKey ? 'text' : 'password'}
              value={currentApiKey}
              onChange={(e) => updateConfig(nodeId, { ...config, api_key: e.target.value })}
              placeholder={providerInfo?.hint || 'Enter API key...'}
              className="flex-1 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="px-3 py-1 text-xs border rounded hover:bg-muted"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {currentApiKey
              ? `Key: ${maskKey(currentApiKey)}`
              : `Set ${providerInfo?.envKey} or enter key above`}
          </p>
        </div>
      )}

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

      {/* Tools */}
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
