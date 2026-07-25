'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RunnerKind = 'stub' | 'aider';
export type Provider = 'groq' | 'gemini' | 'openai' | 'deepseek' | 'anthropic' | 'openrouter' | 'custom';

/** Provider -> the model ids it serves. First = default. */
export const PROVIDER_MODEL_OPTIONS: Record<Provider, string[]> = {
  groq: [
    'groq/llama-3.3-70b-versatile',
    'groq/llama-3.1-8b-instant',
    'groq/mixtral-8x7b-32768',
    'groq/gemma2-9b-it',
  ],
  gemini: [
    'gemini/gemini-2.0-flash',
    'gemini/gemini-1.5-pro',
    'gemini/gemini-1.5-flash',
  ],
  openai: [
    'openai/gpt-4o',
    'openai/gpt-4o-mini',
    'openai/o1-mini',
  ],
  deepseek: [
    'deepseek/deepseek-chat',
    'deepseek/deepseek-reasoner',
  ],
  anthropic: [
    'anthropic/claude-3-5-sonnet-20241022',
    'anthropic/claude-3-5-haiku-20241022',
  ],
  openrouter: [
    'openrouter/meta-llama/llama-3.3-70b-instruct',
    'openrouter/anthropic/claude-3.5-sonnet',
    'openrouter/deepseek/deepseek-chat',
  ],
  custom: [],
};

/** Provider -> its default model (first option). */
export const PROVIDER_MODELS: Record<Provider, string> = Object.fromEntries(
  Object.entries(PROVIDER_MODEL_OPTIONS).map(([p, models]) => [p, models[0]]),
) as Record<Provider, string>;

export const PROVIDER_LABELS: Record<Provider, string> = {
  groq: 'Groq',
  gemini: 'Gemini',
  openai: 'OpenAI',
  deepseek: 'DeepSeek',
  anthropic: 'Anthropic',
  openrouter: 'OpenRouter',
  custom: 'Custom (OpenAI-compatible)',
};

/** Provider -> default base URL. Empty = use OpenAI SDK default. */
export const PROVIDER_BASE_URLS: Record<Provider, string> = {
  groq: 'https://api.groq.com/openai/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
  openai: '',
  deepseek: 'https://api.deepseek.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  custom: '',
};

interface SettingsState {
  runner: RunnerKind;
  provider: Provider;
  model: string;          // editable; auto-filled from provider default
  apiKey: string;         // BYOK — persisted to localStorage on this machine only
  baseUrl: string;        // custom base URL for OpenAI-compatible endpoints
  modelTouched: boolean;  // true once the user hand-edits the model field

  setRunner: (r: RunnerKind) => void;
  setProvider: (p: Provider) => void;
  setModel: (m: string) => void;
  setApiKey: (k: string) => void;
  setBaseUrl: (url: string) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      runner: 'aider',
      provider: 'groq',
      model: PROVIDER_MODELS.groq,
      apiKey: '',
      baseUrl: '',
      modelTouched: false,

      setRunner: (runner) => set({ runner }),
      setProvider: (provider) =>
        set({
          provider,
          // Keep model in sync unless the user has customised it.
          model: get().modelTouched ? get().model : PROVIDER_MODELS[provider],
          // Auto-fill base URL for known providers
          baseUrl: PROVIDER_BASE_URLS[provider],
        }),
      setModel: (model) => set({ model, modelTouched: true }),
      setApiKey: (apiKey) => set({ apiKey }),
      setBaseUrl: (baseUrl) => set({ baseUrl }),
    }),
    { name: 'apex-settings' },
  ),
);

/** Non-React accessor for api.ts. */
export function getExecutionSettings() {
  const { runner, model, apiKey, baseUrl } = useSettingsStore.getState();
  return { runner, model, apiKey, baseUrl };
}
