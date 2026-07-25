'use client';

import React, { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from '@xyflow/react';
import { Trash2, Check, X } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { cn } from '@/lib/utils';

const APPROVED = '#10b981'; // emerald
const REJECTED = '#ef4444'; // red

export function SelectableEdge(props: EdgeProps) {
  const { id, source, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, style, sourceHandleId } = props;
  const { setEdges } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);

  const sourceNode = useWorkflowStore((s) => s.nodes.find((n) => n.id === source));
  const sourceType = sourceNode?.type;
  const sourceStatus = sourceNode?.data?.status as string | undefined;
  const isRunning = sourceStatus === 'running';
  const setEdgeOutcome = useWorkflowStore((s) => s.setEdgeOutcome);
  const isGate = sourceType === 'human_gate';
  const isBranch = isGate || sourceType === 'decision';
  const outcome = ((props.data as { outcome?: 'success' | 'failure' } | undefined)?.outcome) ?? 'success';

  // Determine if this is the pass/approve edge or fail/reject edge
  const isBottomHandle = sourceHandleId === 'source-bottom';
  const isTopHandle = sourceHandleId === 'top-source';
  const edgeOutcome = isBottomHandle ? 'failure' : isTopHandle ? 'failure' : outcome;
  const branchColor = edgeOutcome === 'failure' ? REJECTED : APPROVED;

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEdges((eds) => eds.filter((e) => e.id !== id));
  };

  const baseStroke = isBranch
    ? branchColor
    : selected || isHovered
      ? 'var(--primary)'
      : style?.stroke || 'var(--muted-foreground)';

  // Determine label text
  const labelText = isBranch
    ? (isBottomHandle
        ? (isGate ? 'reject' : 'fail')
        : (isGate ? 'approve' : 'pass'))
    : '';

  return (
    <g onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <BaseEdge
        id={id}
        path={edgePath}
        interactionWidth={20}
        markerEnd="url(#arrow)"
        className={selected ? 'edge-selected' : ''}
        style={{
          ...style,
          strokeDasharray: selected ? '6 3' : undefined,
          strokeWidth: selected || isHovered ? 2.5 : 2,
          stroke: baseStroke,
          animation: selected ? 'edge-dash 0.5s linear infinite' : undefined,
          transition: 'stroke-width 0.2s, stroke 0.2s',
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          className="nodrag nopan flex items-center gap-1.5"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          {/* No labels on edges — color and direction indicate pass/fail */}
          {/* Delete button — hidden when running */}
          {!isRunning && (
            <button
              onClick={handleDelete}
              className={`h-8 w-8 flex items-center justify-center transition-all cursor-pointer group ${
                isHovered || selected ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
              }`}
              aria-label="Delete edge"
            >
              <div className={`h-5 w-5 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                selected
                  ? 'bg-destructive text-destructive-foreground hover:brightness-110'
                  : 'bg-background text-muted-foreground border border-border group-hover:bg-destructive group-hover:text-destructive-foreground group-hover:brightness-110'
              }`}>
                <Trash2 className="h-3 w-3" />
              </div>
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </g>
  );
}
