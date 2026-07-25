'use client';

import React, { useState } from 'react';
import { formatTimestamp, cn } from '@/lib/utils';
import type { RunEvent, RunEventKind } from '@/types/run';
import { useUIStore } from '@/stores/ui-store';
import {
  Bot,
  Terminal,
  FileDiff,
  ShieldCheck,
  AlertTriangle,
  RotateCcw,
  UserCheck,
  ChevronRight,
  ChevronDown,
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
  const [expanded, setExpanded] = useState(false);
  const openNodeDetail = useUIStore((s) => s.openNodeDetail);
  const hasDetail = !!event.detail;

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

        {/* Inline expandable detail */}
        {hasDetail && (
          <div className="mt-1">
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 text-[10px] text-muted-foreground/70 hover:text-muted-foreground transition-colors cursor-pointer"
              aria-expanded={expanded}
            >
              {expanded ? (
                <ChevronDown className="h-2.5 w-2.5" />
              ) : (
                <ChevronRight className="h-2.5 w-2.5" />
              )}
              <span className="font-mono truncate max-w-[300px]">{event.detail}</span>
            </button>
            {expanded && (
              <div className="mt-1 pl-3.5 border-l-2 border-border/50">
                {event.type === 'command' ? (
                  <code className="text-[10px] font-mono text-cyan-400/80 break-all whitespace-pre-wrap">
                    {event.detail}
                  </code>
                ) : event.type === 'file_change' ? (
                  <div className="flex items-center gap-2">
                    <FileDiff className="h-3 w-3 text-[var(--color-event-file)]" />
                    <span className="text-[10px] font-mono text-muted-foreground break-all">
                      {event.detail}
                    </span>
                  </div>
                ) : (
                  <pre className="text-[10px] font-mono text-muted-foreground/80 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">
                    {event.detail}
                  </pre>
                )}
              </div>
            )}
          </div>
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
      <button
        onClick={() => openNodeDetail(event.nodeId)}
        className="text-[9px] text-muted-foreground/40 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity font-mono hover:text-muted-foreground cursor-pointer"
        title="View node details"
      >
        {event.nodeId}
      </button>
    </li>
  );
}
