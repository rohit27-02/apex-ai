'use client';

import React, { useEffect, useRef } from 'react';
import { X, CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { useWorkflowStore } from '@/stores/workflow-store';
import { STATUS_LABELS } from '@/constants/status';
import { NODE_TYPE_CONFIG } from '@/constants/node-types';
import { cn } from '@/lib/utils';
import type { NodeStatus } from '@/types/workflow';
import type { CriteriaItem } from '@/types/run';

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

export function NodeDetailPopup() {
  const nodeDetailNodeId = useUIStore((s) => s.nodeDetailNodeId);
  const closeNodeDetail = useUIStore((s) => s.closeNodeDetail);
  const nodes = useWorkflowStore((s) => s.nodes);
  const logsEndRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={closeNodeDetail}>
      <div
        className="bg-card border border-border rounded-xl w-[520px] max-h-[80vh] shadow-2xl overflow-hidden"
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

        {/* Status bar */}
        <div className="px-5 py-3 border-b border-border bg-muted/30">
          <div className="flex items-center gap-2">
            <span className={cn('flex items-center gap-1.5 text-xs font-medium', STATUS_COLORS[nodeStatus])}>
              {STATUS_ICONS[nodeStatus]}
              {STATUS_LABELS[nodeStatus]}
            </span>
          </div>
        </div>

        {/* Content */}
        <div className="px-5 py-4 overflow-y-auto max-h-[50vh] space-y-4">
          {/* Output section */}
          {nodeData.output && (
            <div>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Output
              </h3>
              <div className="bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
                <p className="text-xs text-green-400/90 font-mono leading-relaxed break-words">
                  {nodeData.output}
                </p>
              </div>
            </div>
          )}

          {/* Error section */}
          {nodeData.error && (
            <div>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Error
              </h3>
              <div className="bg-red-500/5 border border-red-500/20 rounded-lg px-3 py-2">
                <p className="text-xs text-red-400/90 font-mono leading-relaxed break-words">
                  {nodeData.error}
                </p>
              </div>
            </div>
          )}

          {/* Criteria section (validation node) — shows WHY it passed/failed */}
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
                      c.status === 'pending' && 'bg-muted/40 border-border'
                    )}
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={cn(
                          'font-semibold',
                          c.status === 'passed' && 'text-green-400',
                          c.status === 'failed' && 'text-red-400',
                          c.status === 'pending' && 'text-muted-foreground'
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

          {/* Logs section — streamed LLM thinking + tool usage */}
          {logs && logs.length > 0 && (
            <div>
              <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Logs {nodeStatus === 'running' && <span className="text-[#E20074] normal-case">· streaming…</span>}
              </h3>
              <div className="bg-black/40 border border-border rounded-lg p-3 max-h-64 overflow-y-auto">
                <div className="font-mono text-[10.5px] leading-relaxed text-foreground/80 whitespace-pre-wrap break-words">
                  {logs.map((line, i) => (
                    <div key={i} className={cn(line.startsWith('  ✗') && 'text-red-400', line.startsWith('  ✓') && 'text-green-400', line.startsWith('$') && 'text-cyan-400/80')}>
                      {line}
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          )}

          {/* Config section */}
          <div>
            <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Configuration
            </h3>
            <div className="bg-muted/50 rounded-lg px-3 py-2 space-y-1">
              {Object.entries(nodeData.config).map(([key, value]) => (
                <div key={key} className="flex items-start gap-2 text-xs">
                  <span className="text-muted-foreground font-medium shrink-0">{key}:</span>
                  <span className="text-foreground font-mono break-words">
                    {Array.isArray(value) ? value.join(', ') : String(value || '—')}
                  </span>
                </div>
              ))}
            </div>
          </div>
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
