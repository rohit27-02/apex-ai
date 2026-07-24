'use client';

import React, { useState } from 'react';
import { BaseEdge, EdgeLabelRenderer, getBezierPath, useReactFlow, type EdgeProps } from '@xyflow/react';
import { Trash2 } from 'lucide-react';

export function SelectableEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, selected, label, style } = props;
  const { setEdges } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);

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

  return (
    <g
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <BaseEdge
        id={id}
        path={edgePath}
        interactionWidth={20}
        className={selected ? 'edge-selected' : ''}
        style={{
          ...style,
          strokeDasharray: selected ? '6 3' : undefined,
          strokeWidth: selected || isHovered ? 2.5 : 2,
          stroke: selected || isHovered ? 'var(--primary)' : style?.stroke || 'var(--muted-foreground)',
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
          {label && (
            <span className="text-[10px] font-mono text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">
              {label}
            </span>
          )}
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
        </div>
      </EdgeLabelRenderer>
    </g>
  );
}
