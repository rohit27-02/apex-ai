import type { NodeType } from '@/types/workflow';
import {
  FileInput,
  Bot,
  Terminal,
  ShieldCheck,
  GitBranch,
  UserCheck,
  CheckCircle2,
  XCircle,
} from 'lucide-react';

export interface NodeTypeConfig {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  /** CSS var name for the icon color (set per-theme in globals.css) */
  colorVar: string;
  /** CSS var name for the icon background (set per-theme in globals.css) */
  bgVar: string;
}

export const NODE_TYPE_CONFIG: Record<NodeType, NodeTypeConfig> = {
  input: {
    label: 'Input',
    icon: FileInput,
    accentColor: 'var(--color-input)',
    colorVar: '--color-input',
    bgVar: '--color-input-bg',
  },
  agent: {
    label: 'Agent',
    icon: Bot,
    accentColor: 'var(--color-agent)',
    colorVar: '--color-agent',
    bgVar: '--color-agent-bg',
  },
  command: {
    label: 'Command',
    icon: Terminal,
    accentColor: 'var(--color-command)',
    colorVar: '--color-command',
    bgVar: '--color-command-bg',
  },
  validator: {
    label: 'Validator',
    icon: ShieldCheck,
    accentColor: 'var(--color-validator)',
    colorVar: '--color-validator',
    bgVar: '--color-validator-bg',
  },
  decision: {
    label: 'Decision',
    icon: GitBranch,
    accentColor: 'var(--color-decision)',
    colorVar: '--color-decision',
    bgVar: '--color-decision-bg',
  },
  human_gate: {
    label: 'Human Gate',
    icon: UserCheck,
    accentColor: 'var(--color-human-gate)',
    colorVar: '--color-human-gate',
    bgVar: '--color-human-gate-bg',
  },
  success: {
    label: 'Success',
    icon: CheckCircle2,
    accentColor: 'var(--color-success)',
    colorVar: '--color-success',
    bgVar: '--color-success-bg',
  },
  stop: {
    label: 'Stop',
    icon: XCircle,
    accentColor: 'var(--color-stop)',
    colorVar: '--color-stop',
    bgVar: '--color-stop-bg',
  },
};
