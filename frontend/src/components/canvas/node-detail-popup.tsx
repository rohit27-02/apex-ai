'use client';

import React from 'react';
import { X, CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, RotateCcw, Bot, Terminal, FileDiff, ShieldCheck, UserCheck } from 'lucide-react';
import { useUIStore } from '@/stores/ui-store';
import { useWorkflowStore } from '@/stores/workflow-store';
import { STATUS_LABELS } from '@/constants/status';
import { NODE_TYPE_CONFIG } from '@/constants/node-types';
import { cn } from '@/lib/utils';
import type { NodeStatus } from '@/types/workflow';
import type { RunEvent, RunEventKind } from '@/types/run';

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
  command: 'text-blue-400',
  file_change: 'text-emerald-400',
  validation: 'text-cyan-400',
  error: 'text-destructive',
  retry: 'text-amber-400',
  human_feedback: 'text-purple-400',
};

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
  const run = useWorkflowStore((s) => s.nodes); // We get run from the page props

  const node = nodes.find((n) => n.id === nodeDetailNodeId);

  // Get run data from the store's workflow or we need to pass it as prop
  // For now, we'll use the node data which already has status/output/error synced
  if (!node || !nodeDetailNodeId) return null;

  const nodeData = node.data as {
    label: string;
    nodeType: string;
    status?: string;
    output?: string;
    error?: string;
    config: Record<string, unknown>;
  };

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
