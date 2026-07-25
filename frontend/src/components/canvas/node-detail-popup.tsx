'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Coins,
  Timer,
  FileText,
  Terminal,
  Settings,
} from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { useWorkflowStore } from '@/stores/workflow-store';
import { STATUS_LABELS } from '@/constants/status';
import { NODE_TYPE_CONFIG } from '@/constants/node-types';
import { cn } from '@/lib/utils';
import type { NodeStatus } from '@/types/workflow';
import type { CriteriaItem, TokenUsage } from '@/types/run';

const STATUS_ICONS: Record<string, React.ReactNode> = {
  idle: null,
  running: <Loader2 className="h-4 w-4 animate-spin" />,
  success: <CheckCircle2 className="h-4 w-4" />,
  failure: <XCircle className="h-4 w-4" />,
  waiting: <Clock className="h-4 w-4 animate-pulse" />,
  skipped: null,
};

const STATUS_COLORS: Record<string, string> = {
  running: 'text-[#E20074]',
  success: 'text-green-400',
  failure: 'text-red-400',
  waiting: 'text-amber-400',
};

type TabId = 'logs' | 'output' | 'config';

const TABS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'logs', label: 'Logs', icon: Terminal },
  { id: 'output', label: 'Output', icon: FileText },
  { id: 'config', label: 'Config', icon: Settings },
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTokens(tokens: TokenUsage): string {
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
  return `${fmt(tokens.input)} in / ${fmt(tokens.output)} out`;
}

/** Markdown renderer — handles code blocks, inline code, bold, headers, lists. */
function MarkdownLog({ text }: { text: string }) {
  const parts = useMemo(() => {
    const lines = text.split('\n');
    const result: { type: 'text' | 'code' | 'header' | 'list'; content: string; level?: number }[] = [];
    let inCodeBlock = false;
    let codeLines: string[] = [];
    let codeLang = '';

    for (const line of lines) {
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          result.push({ type: 'code', content: codeLines.join('\n') });
          codeLines = [];
          codeLang = line.slice(3).trim();
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
          codeLang = line.slice(3).trim();
        }
      } else if (inCodeBlock) {
        codeLines.push(line);
      } else if (line.startsWith('# ')) {
        result.push({ type: 'header', content: line.slice(2), level: 1 });
      } else if (line.startsWith('## ')) {
        result.push({ type: 'header', content: line.slice(3), level: 2 });
      } else if (line.startsWith('### ')) {
        result.push({ type: 'header', content: line.slice(4), level: 3 });
      } else if (/^[-*]\s/.test(line)) {
        result.push({ type: 'list', content: line.replace(/^[-*]\s/, '') });
      } else {
        result.push({ type: 'text', content: line });
      }
    }
    if (codeLines.length > 0) {
      result.push({ type: 'code', content: codeLines.join('\n') });
    }
    return result;
  }, [text]);

  return (
    <>
      {parts.map((part, i) => {
        if (part.type === 'code') {
          return (
            <pre key={i} className="bg-black/60 border border-border/50 rounded-md px-3 py-2 my-1 overflow-x-auto">
              <code className="text-[10.5px] font-mono text-emerald-300/90 whitespace-pre">{part.content}</code>
            </pre>
          );
        }
        if (part.type === 'header') {
          if (part.level === 1) return <h1 key={i} className="text-base font-bold text-foreground/90 my-1">{renderInline(part.content)}</h1>;
          if (part.level === 2) return <h2 key={i} className="text-sm font-bold text-foreground/90 my-1">{renderInline(part.content)}</h2>;
          return <h3 key={i} className="text-xs font-bold text-foreground/90 my-1">{renderInline(part.content)}</h3>;
        }
        if (part.type === 'list') {
          return (
            <div key={i} className="flex gap-2 my-0.5">
              <span className="text-muted-foreground" aria-hidden="true">•</span>
              <span>{renderInline(part.content)}</span>
            </div>
          );
        }
        return <div key={i} className="leading-relaxed">{renderInline(part.content)}</div>;
      })}
    </>
  );
}

function renderInline(text: string): React.ReactNode {
  // Bold: **text**
  const boldParts = text.split(/(\*\*[^*]+\*\*)/);
  return boldParts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i} className="font-semibold text-foreground/90">{part.slice(2, -2)}</strong>;
    }
    // Inline code: `text`
    const codeParts = part.split(/(`[^`]+`)/);
    return codeParts.map((segment, j) => {
      if (segment.startsWith('`') && segment.endsWith('`')) {
        return <code key={`${i}-${j}`} className="bg-muted/60 px-1 py-0.5 rounded text-[10.5px] font-mono text-cyan-300/80">{segment.slice(1, -1)}</code>;
      }
      return <span key={`${i}-${j}`}>{segment}</span>;
    });
  });
}

export function NodeDetailPopup() {
  const nodeDetailNodeId = useUIStore((s) => s.nodeDetailNodeId);
  const closeNodeDetail = useUIStore((s) => s.closeNodeDetail);
  const nodes = useWorkflowStore((s) => s.nodes);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<TabId>('logs');

  const node = nodes.find((n) => n.id === nodeDetailNodeId);

  const nodeData = node?.data as
    | {
        label: string;
        nodeType: string;
        status?: string;
        output?: string;
        error?: string;
        logs?: string[] | null;
        criteria?: CriteriaItem[] | null;
        config: Record<string, unknown>;
        tokenUsage?: TokenUsage;
        durationMs?: number;
      }
    | undefined;

  const logs = nodeData?.logs ?? null;

  // Auto-scroll the logs to the newest line as they stream in.
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ block: 'end' });
  }, [logs?.length]);

  if (!node || !nodeDetailNodeId || !nodeData) return null;

  const nodeStatus = (nodeData.status as NodeStatus) ?? 'idle';
  const nodeConfig = NODE_TYPE_CONFIG[nodeData.nodeType as keyof typeof NODE_TYPE_CONFIG];
  const Icon = nodeConfig?.icon;

  const hasLogs = logs && logs.length > 0;
  const hasOutput = !!nodeData.output;
  const hasConfig = Object.keys(nodeData.config).length > 0;

  // Auto-select first available tab
  const effectiveTab =
    (activeTab === 'logs' && !hasLogs && hasOutput ? 'output' : activeTab);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeNodeDetail}>
      <div
        className="bg-card border border-border rounded-xl w-[560px] max-h-[85vh] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            {Icon && (
              <div
                className="rounded-lg p-2"
                style={{ backgroundColor: `var(${nodeConfig.bgVar})` }}
              >
                <span style={{ color: `var(${nodeConfig.colorVar})` }}>
                  <Icon className="h-5 w-5" />
                </span>
              </div>
            )}
            <div>
              <h2 className="text-sm font-semibold text-foreground">{nodeData.label}</h2>
              <p className="text-[11px] text-muted-foreground">{nodeConfig?.label}</p>
            </div>
          </div>
          <button
            onClick={closeNodeDetail}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Status + Stats bar */}
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-4 flex-wrap">
            <span className={cn('flex items-center gap-1.5 text-xs font-medium', STATUS_COLORS[nodeStatus])}>
              {STATUS_ICONS[nodeStatus]}
              {STATUS_LABELS[nodeStatus]}
            </span>

            {/* Token usage */}
            {nodeData.tokenUsage && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                <Coins className="h-3 w-3" aria-hidden="true" />
                {formatTokens(nodeData.tokenUsage)}
              </span>
            )}

            {/* Duration */}
            {nodeData.durationMs != null && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
                <Timer className="h-3 w-3" aria-hidden="true" />
                {formatDuration(nodeData.durationMs)}
              </span>
            )}
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex border-b border-border">
          {TABS.map((tab) => {
            const TabIcon = tab.icon;
            const isVisible =
              tab.id === 'logs' ? hasLogs :
              tab.id === 'output' ? hasOutput :
              hasConfig;
            if (!isVisible) return null;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors cursor-pointer',
                  effectiveTab === tab.id
                    ? 'border-primary text-primary'
                    : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border',
                )}
              >
                <TabIcon className="h-3.5 w-3.5" aria-hidden="true" />
                {tab.label}
                {tab.id === 'logs' && hasLogs && (
                  <span className="ml-1 text-[10px] text-muted-foreground/60">{logs!.length}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="px-5 py-4 overflow-y-auto max-h-[55vh]">
          {/* Logs tab */}
          {effectiveTab === 'logs' && hasLogs && (
            <div
              className="bg-black/40 border border-border rounded-lg p-3 max-h-[50vh] overflow-y-auto"
              role="log"
              aria-live="polite"
              aria-label="Agent execution logs"
            >
              <div className="font-mono text-[10.5px] leading-relaxed text-foreground/80">
                {nodeStatus === 'running' && (
                  <div className="flex items-center gap-1.5 text-[#E20074] mb-2">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="text-[11px]">Streaming logs…</span>
                  </div>
                )}
                {logs!.map((line, i) => (
                  <div
                    key={i}
                    className={cn(
                      // Status colors
                      line.startsWith('  ✗') && 'text-red-400 font-medium',
                      line.startsWith('  ✓') && 'text-emerald-400 font-medium',
                      // Commands
                      line.startsWith('$') && 'text-cyan-300/90',
                      // Turn separators
                      line.startsWith('---') && 'text-muted-foreground/40 italic',
                      // Errors and warnings
                      line.startsWith('[') && line.includes('error') && 'text-red-400/90',
                      line.startsWith('[') && line.includes('warning') && 'text-amber-400/90',
                      line.startsWith('[') && line.includes('rate limit') && 'text-amber-400/90',
                      // Agent thinking (not commands, not status)
                      !line.startsWith('$') && !line.startsWith('  ✗') && !line.startsWith('  ✓') && !line.startsWith('---') && !line.startsWith('[') && 'text-foreground/70',
                    )}
                  >
                    <MarkdownLog text={line} />
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>
          )}

          {/* Output tab */}
          {effectiveTab === 'output' && (
            <div className="space-y-3">
              {nodeData.output && (
                <div className="bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-green-400/90 font-mono leading-relaxed break-words">
                    {nodeData.output}
                  </p>
                </div>
              )}
              {nodeData.error && (
                <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                  <p className="text-xs text-red-400/90 font-mono leading-relaxed break-words">
                    {nodeData.error}
                  </p>
                </div>
              )}
              {nodeData.criteria && nodeData.criteria.length > 0 && (
                <div>
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                    Criteria
                  </h3>
                  <div className="space-y-2">
                    {nodeData.criteria.map((c) => (
                      <div
                        key={c.id}
                        className={cn(
                          'rounded-lg border px-3 py-2',
                          c.status === 'passed' && 'bg-green-500/5 border-green-500/20',
                          c.status === 'failed' && 'bg-red-500/5 border-red-500/20',
                          c.status === 'pending' && 'bg-muted/40 border-border',
                        )}
                      >
                        <div className="flex items-center gap-2 text-xs">
                          <span
                            className={cn(
                              'font-semibold',
                              c.status === 'passed' && 'text-green-400',
                              c.status === 'failed' && 'text-red-400',
                              c.status === 'pending' && 'text-muted-foreground',
                            )}
                          >
                            {c.status === 'passed' ? '✓' : c.status === 'failed' ? '✗' : '○'} {c.id}
                          </span>
                          <span className="text-muted-foreground">{c.label}</span>
                        </div>
                        {c.status === 'failed' && c.evidence && (
                          <pre className="mt-1.5 text-[10px] text-red-400/80 font-mono whitespace-pre-wrap break-words max-h-40 overflow-y-auto">
                            {c.evidence}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Config tab */}
          {effectiveTab === 'config' && (
            <div className="bg-muted/50 rounded-lg px-3 py-2 space-y-1">
              {Object.entries(nodeData.config).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground font-medium shrink-0">{key}:</span>
                  <span className="text-foreground font-mono break-words">
                    {Array.isArray(value) ? value.join(', ') : String(value ?? '—')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/20">
          <p className="text-[10px] text-muted-foreground/60 text-center">
            Node ID: {nodeDetailNodeId}
          </p>
        </div>
      </div>
    </div>
  );
}
