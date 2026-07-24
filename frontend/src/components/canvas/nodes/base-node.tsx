'use client';

import React, { memo, useState, useRef, useEffect } from 'react';
import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { cn } from '@/lib/utils';
import { NODE_TYPE_CONFIG } from '@/constants/node-types';
import { STATUS_LABELS } from '@/constants/status';
import type { NodeType, NodeStatus } from '@/types/workflow';
import { useWorkflowStore } from '@/stores/workflow-store';
import { useUIStore } from '@/stores/ui-store';
import { Trash2, Pencil, Loader2, CheckCircle2, XCircle, Clock, FileText } from 'lucide-react';

interface BaseNodeData {
  label: string;
  config: Record<string, unknown>;
  nodeType: NodeType;
  status?: string;
  output?: string;
  error?: string;
}

function StatusBadge({ status }: { status: NodeStatus }) {
  if (status === 'idle' || status === 'skipped') return null;

  const icons: Record<string, React.ReactNode> = {
    running: <Loader2 className="h-3 w-3 animate-spin" />,
    success: <CheckCircle2 className="h-3 w-3" />,
    failure: <XCircle className="h-3 w-3" />,
    waiting: <Clock className="h-3 w-3 animate-pulse" />,
  };

  const colors: Record<string, string> = {
    running: 'bg-[#E20074] text-white',
    success: 'bg-green-500 text-white',
    failure: 'bg-red-500 text-white',
    waiting: 'bg-amber-500 text-white',
  };

  return (
    <div
      className={cn(
        'absolute -top-2.5 -left-2.5 z-20 flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider shadow-md',
        colors[status],
        status === 'running' && 'animate-magenta-pulse',
      )}
    >
      {icons[status]}
      <span>{STATUS_LABELS[status]}</span>
    </div>
  );
}

function BaseNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as BaseNodeData;
  const nodeType = nodeData.nodeType;
  const nodeConfig = NODE_TYPE_CONFIG[nodeType];
  const Icon = nodeConfig.icon;

  const selectNode = useWorkflowStore((s) => s.selectNode);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const updateNodeLabel = useWorkflowStore((s) => s.updateNodeLabel);
  const openInspector = useUIStore((s) => s.openInspector);
  const openNodeDetail = useUIStore((s) => s.openNodeDetail);

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(nodeData.label);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleClick = () => {
    if (!isEditing) {
      selectNode(id);
      openInspector();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isEditing) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleClick();
    }
  };

  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditValue(nodeData.label);
    setIsEditing(true);
  };

  const handleRenameConfirm = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== nodeData.label) {
      updateNodeLabel(id, trimmed);
    }
    setIsEditing(false);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleRenameConfirm();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  };

  const handleShowDetail = (e: React.MouseEvent) => {
    e.stopPropagation();
    openNodeDetail(id);
  };

  const configSummary = getConfigSummary(nodeType, nodeData.config);
  const nodeStatus = (nodeData.status as NodeStatus) ?? 'idle';
  const hasRunData = nodeStatus !== 'idle' && nodeStatus !== 'skipped';

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${nodeData.label} node, ${nodeConfig.label} type, status: ${STATUS_LABELS[nodeStatus] ?? 'Idle'}`}
      aria-selected={selected}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onKeyDown={handleKeyDown}
      className={cn(
        'group relative min-w-[200px] rounded-xl border p-3.5 cursor-pointer transition-all duration-200',
        'bg-card',
        'hover:shadow-lg',
        selected && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
        // Status-driven border colors
        nodeStatus === 'running' && 'border-[#E20074] animate-magenta-pulse',
        nodeStatus === 'success' && 'border-green-500',
        nodeStatus === 'failure' && 'border-red-500',
        nodeStatus === 'waiting' && 'border-amber-500',
        nodeStatus === 'skipped' && 'border-muted-foreground/30 opacity-60',
        // Default border when idle
        nodeStatus === 'idle' && 'border-border',
      )}
      style={{ boxShadow: 'var(--node-shadow)' }}
    >
      {/* Status badge */}
      <StatusBadge status={nodeStatus} />

      {/* Delete button */}
      <button
        onClick={handleDelete}
        className={`absolute -top-3 -right-3 z-10 h-8 w-8 cursor-pointer flex items-center justify-center transition-all ${
          selected ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 group-hover:pointer-events-auto'
        }`}
        aria-label={`Delete ${nodeData.label} node`}
      >
        <div className="h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:brightness-110 transition-colors shadow-md">
          <Trash2 className="h-3 w-3" />
        </div>
      </button>

      {/* Header */}
      <div className="flex items-center gap-2.5 mb-2.5">
        <div
          className="rounded-lg p-1.5 shrink-0"
          style={{ backgroundColor: `var(${nodeConfig.bgVar})` }}
          aria-hidden="true"
        >
          <span style={{ color: `var(${nodeConfig.colorVar})` }}>
            <Icon className="h-4 w-4" />
          </span>
        </div>
        <div className="flex-1 min-w-0 text-left">
          {isEditing ? (
            <input
              ref={inputRef}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={handleRenameConfirm}
              onKeyDown={handleRenameKeyDown}
              onClick={(e) => e.stopPropagation()}
              className="text-[13px] font-semibold text-foreground bg-background border border-ring rounded px-1 py-0.5 w-full outline-none"
            />
          ) : (
            <div className="flex items-center gap-1.5 group">
              <div className="text-[13px] font-semibold text-foreground truncate leading-tight">
                {nodeData.label}
              </div>
              {selected && (
                <button
                  onClick={handleDoubleClick}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
                  aria-label={`Rename ${nodeData.label}`}
                >
                  <Pencil className="h-3 w-3" />
                </button>
              )}
            </div>
          )}
          <div className="text-[10px] font-medium text-muted-foreground mt-0.5">
            {nodeConfig.label}
          </div>
        </div>
      </div>

      {/* Config summary */}
      {configSummary && (
        <div className="text-[10px] text-muted-foreground border-t border-border pt-2 mt-1 font-mono leading-relaxed text-left">
          {configSummary}
        </div>
      )}

      {/* Detail expand button — shown when node has run data */}
      {hasRunData && (
        <button
          onClick={handleShowDetail}
          className="absolute bottom-1.5 right-1.5 z-10 h-6 w-6 flex items-center justify-center rounded-md bg-background/80 border border-border/50 text-muted-foreground hover:text-foreground hover:bg-background transition-all opacity-0 group-hover:opacity-100"
          aria-label={`View details for ${nodeData.label}`}
          title="View run details"
        >
          <FileText className="h-3 w-3" />
        </button>
      )}

      {/* Handles */}
      <Handle
        type="target"
        position={Position.Left}
        className={`!w-3 !h-3 !border-2 before:content-[''] before:absolute before:-inset-2 before:bg-transparent before:rounded-full ${
          selected ? '!bg-primary !border-primary' : '!bg-muted-foreground/50 !border-muted-foreground/70 hover:!bg-primary hover:!border-primary'
        }`}
        aria-label="Input connection"
      />
      <Handle
        type="source"
        position={Position.Right}
        className={`!w-3 !h-3 !border-2 before:content-[''] before:absolute before:-inset-2 before:bg-transparent before:rounded-full ${
          selected ? '!bg-primary !border-primary' : '!bg-muted-foreground/50 !border-muted-foreground/70 hover:!bg-primary hover:!border-primary'
        }`}
        aria-label="Output connection"
      />
      <Handle
        type="target"
        id="top-target"
        position={Position.Top}
        className={`!w-3 !h-3 !border-2 before:content-[''] before:absolute before:-inset-2 before:bg-transparent before:rounded-full ${
          selected ? '!bg-primary !border-primary' : '!bg-muted-foreground/50 !border-muted-foreground/70 hover:!bg-primary hover:!border-primary'
        }`}
        aria-label="Top input connection"
      />
      <Handle
        type="source"
        id="top-source"
        position={Position.Top}
        className={`!w-3 !h-3 !border-2 before:content-[''] before:absolute before:-inset-2 before:bg-transparent before:rounded-full ${
          selected ? '!bg-primary !border-primary' : '!bg-muted-foreground/50 !border-muted-foreground/70 hover:!bg-primary hover:!border-primary'
        }`}
        aria-label="Top output connection"
      />
    </div>
  );
}

function getConfigSummary(nodeType: NodeType, config: Record<string, unknown>): string | null {
  switch (nodeType) {
    case 'input':
      return (config.objective as string) || 'No objective set';
    case 'agent':
      return `Model: ${config.model ?? 'none'} · ${(config.tools as string[])?.length ?? 0} tools`;
    case 'command':
      return (config.command as string) || 'No command';
    case 'validator':
      return `${(config.criteria as string[])?.length ?? 0} criteria · Retry: ${config.retryLimit ?? 1}`;
    case 'decision':
      return (config.condition as string) || 'No condition';
    case 'human_gate':
      return config.required ? 'Required approval' : 'Optional approval';
    case 'success':
      return (config.message as string) || 'Complete';
    case 'stop':
      return (config.reason as string) || 'Stopped';
    default:
      return null;
  }
}

export const InputNode = memo((props: NodeProps) => <BaseNode {...props} />);
export const AgentNode = memo((props: NodeProps) => <BaseNode {...props} />);
export const CommandNode = memo((props: NodeProps) => <BaseNode {...props} />);
export const ValidatorNode = memo((props: NodeProps) => <BaseNode {...props} />);
export const DecisionNode = memo((props: NodeProps) => <BaseNode {...props} />);
export const HumanGateNode = memo((props: NodeProps) => <BaseNode {...props} />);
export const SuccessNode = memo((props: NodeProps) => <BaseNode {...props} />);
export const StopNode = memo((props: NodeProps) => <BaseNode {...props} />);

InputNode.displayName = 'InputNode';
AgentNode.displayName = 'AgentNode';
CommandNode.displayName = 'CommandNode';
ValidatorNode.displayName = 'ValidatorNode';
DecisionNode.displayName = 'DecisionNode';
HumanGateNode.displayName = 'HumanGateNode';
SuccessNode.displayName = 'SuccessNode';
StopNode.displayName = 'StopNode';
