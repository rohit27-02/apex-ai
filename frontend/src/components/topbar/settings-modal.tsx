'use client';

import React, { useState } from 'react';
import { Settings, X, Eye, EyeOff, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  useSettingsStore,
  PROVIDER_LABELS,
  PROVIDER_MODELS,
  type Provider,
  type RunnerKind,
} from '@/stores/settings-store';
import { cn } from '@/lib/utils';

const PROVIDERS = Object.keys(PROVIDER_LABELS) as Provider[];

const PROVIDER_KEY_HINT: Record<Provider, string> = {
  groq: 'console.groq.com/keys',
  gemini: 'aistudio.google.com/apikey',
  openai: 'platform.openai.com/api-keys',
  deepseek: 'platform.deepseek.com',
  anthropic: 'console.anthropic.com',
  openrouter: 'openrouter.ai/keys',
};

export function SettingsModal() {
  const [open, setOpen] = useState(false);
  const [showKey, setShowKey] = useState(false);
  const { runner, provider, model, apiKey, setRunner, setProvider, setModel, setApiKey } =
    useSettingsStore();

  const isAider = runner === 'aider';
  const configured = !isAider || apiKey.trim().length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Model & API key settings"
        title="Model & API key (BYOK)"
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
      >
        <Settings className="h-4 w-4" aria-hidden="true" />
        {/* amber dot when aider is selected but no key entered */}
        {isAider && !apiKey.trim() && (
          <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 w-[460px] shadow-2xl">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-sm font-semibold text-foreground">Execution Settings</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Bring your own key. Stored only in this browser; sent per-run to the backend.
            </p>

            {/* Runner */}
            <label className="text-xs text-muted-foreground font-medium mb-1.5 block">Runner</label>
            <div className="flex gap-2 mb-4">
              {(['stub', 'aider'] as RunnerKind[]).map((r) => (
                <button
                  key={r}
                  onClick={() => setRunner(r)}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                    runner === r
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-muted border-border text-muted-foreground hover:text-foreground',
                  )}
                >
                  {r === 'stub' ? 'Stub (no key, instant)' : 'Aider (real LLM)'}
                </button>
              ))}
            </div>

            {isAider && (
              <>
                {/* Provider */}
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                  Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as Provider)}
                  className="w-full mb-4 h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
                >
                  {PROVIDERS.map((p) => (
                    <option key={p} value={p}>
                      {PROVIDER_LABELS[p]}
                    </option>
                  ))}
                </select>

                {/* Model */}
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                  Model
                </label>
                <Input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={PROVIDER_MODELS[provider]}
                  className="mb-4 font-mono text-xs"
                />

                {/* API key */}
                <label className="text-xs text-muted-foreground font-medium mb-1.5 block">
                  API Key
                </label>
                <div className="relative mb-1">
                  <Input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="paste your key…"
                    className="font-mono text-xs pr-9"
                    autoComplete="off"
                  />
                  <button
                    onClick={() => setShowKey((s) => !s)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showKey ? 'Hide key' : 'Show key'}
                    type="button"
                  >
                    {showKey ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground/60 mb-4">
                  Get a {PROVIDER_LABELS[provider]} key at {PROVIDER_KEY_HINT[provider]}
                </p>
              </>
            )}

            <div className="flex items-center justify-between">
              <span
                className={cn(
                  'text-[11px] flex items-center gap-1',
                  configured ? 'text-emerald-500' : 'text-amber-500',
                )}
              >
                {configured ? (
                  <>
                    <Check className="h-3 w-3" /> Ready
                  </>
                ) : (
                  'API key required for Aider'
                )}
              </span>
              <Button size="sm" variant="default" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
