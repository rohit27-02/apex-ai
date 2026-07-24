'use client';

import React from 'react';
import { formatTimestamp, cn } from '@/lib/utils';
import type { RunEvent, RunEventKind } from '@/types/run';
import {
  Bot,
  Terminal,
  FileDiff,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  UserCheck,
} from 'lucide-react';

const EVENT_ICONS: Record<RunEventKind, React.ComponentType<{ className?: string }>> = {
  agent_message: Bot,
  command: Terminal,
  file_change: FileDiff,
  validation: ShieldCheck,
  error: AlertTriangle,
  retry: RotateCcw,
  human_feedback: UserCheck,
};

const EVENT_COLORS: Record<RunEventKind, string> = {
  agent_message: 'text-primary',
  command: 'text-[var(--color-event-command)]',
  file_change: 'text-[var(--color-event-file)]',
  validation: 'text-[var(--color-event-validation)]',
  error: 'text-destructive',
  retry: 'text-[var(--color-event-retry)]',
  human_feedback: 'text-[var(--color-event-human)]',
};

const EVENT_LABELS: Record<RunEventKind, string> = {
  agent_message: 'Agent message',
  command: 'Command executed',
  file_change: 'File changed',
  validation: 'Validation check',
  error: 'Error occurred',
  retry: 'Retry attempt',
  human_feedback: 'Human feedback',
};

interface ConsoleEntryProps {
  event: RunEvent;
}

export function ConsoleEntry({ event }: ConsoleEntryProps) {
  const Icon = EVENT_ICONS[event.type] ?? Bot;
  const color = EVENT_COLORS[event.type] ?? 'text-muted-foreground';

  return (
    <li className={cn(
      'flex items-start gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-muted group transition-colors',
      event.type === 'error' && 'bg-destructive/5',
      event.type === 'retry' && 'bg-amber-500/5',
    )}>
      <time className="text-[10px] text-muted-foreground mt-0.5 shrink-0 w-[56px] font-mono" dateTime={event.timestamp}>
        {formatTimestamp(event.timestamp)}
      </time>
      <Icon className={cn('h-3.5 w-3.5 mt-0.5 shrink-0', color)} aria-hidden="true" />
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-muted-foreground break-words leading-relaxed">
          <span className="sr-only">{EVENT_LABELS[event.type]}: </span>
          {event.message}
        </div>
        {event.detail && (
          <div className="text-[10px] text-muted-foreground/60 mt-0.5 break-words font-mono">{event.detail}</div>
        )}
        {event.type === 'error' && (
          <div className="text-[10px] text-destructive/80 mt-0.5 break-words font-mono font-medium">
            ERROR: {event.message}
          </div>
        )}
        {event.type === 'retry' && (
          <div className="text-[10px] text-amber-400/80 mt-0.5 break-words font-mono">
            RETRY: {event.message}
          </div>
        )}
      </div>
      <span className="text-[9px] text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity font-mono" aria-hidden="true">
        {event.nodeId}
      </span>
    </li>
  );
}
