import React, { useState } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getSmoothStepPath,
  useReactFlow,
  type EdgeProps,
} from "@xyflow/react";
import { Trash2 } from "lucide-react";
import { useWorkflowStore } from "@/stores/workflow-store";

export function LoopEdge(props: EdgeProps) {
  const {
    id,
    source,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    selected,
  } = props;
  const { setEdges } = useReactFlow();
  const [isHovered, setIsHovered] = useState(false);

  const sourceNode = useWorkflowStore((s) => s.nodes.find((n) => n.id === source));
  const sourceStatus = sourceNode?.data?.status as string | undefined;
  const isRunning = sourceStatus === 'running';

  const isBackward = sourceX > targetX;

  let path, labelX, labelY;

  if (isBackward) {
    const horizontalOffset = 80;
    const heightOffset = 120 + Math.abs(sourceX - targetX) * 0.05;

    let cp1X = sourceX;
    let cp1Y = sourceY;
    switch (sourcePosition) {
      case "right":
        cp1X = sourceX + horizontalOffset;
        cp1Y = sourceY - heightOffset;
        break;
      case "left":
        cp1X = sourceX - horizontalOffset;
        cp1Y = sourceY - heightOffset;
        break;
      case "top":
        cp1X = sourceX;
        cp1Y = sourceY - heightOffset;
        break;
      case "bottom":
        cp1X = sourceX;
        cp1Y = sourceY + heightOffset;
        break;
      default:
        cp1X = sourceX + horizontalOffset;
        cp1Y = sourceY - heightOffset;
    }

    let cp2X = targetX;
    let cp2Y = targetY;
    switch (targetPosition) {
      case "right":
        cp2X = targetX + horizontalOffset;
        cp2Y = targetY - heightOffset;
        break;
      case "left":
        cp2X = targetX - horizontalOffset;
        cp2Y = targetY - heightOffset;
        break;
      case "top":
        cp2X = targetX;
        cp2Y = targetY - heightOffset;
        break;
      case "bottom":
        cp2X = targetX;
        cp2Y = targetY + heightOffset;
        break;
      default:
        cp2X = targetX - horizontalOffset;
        cp2Y = targetY - heightOffset;
    }

    path = `M ${sourceX} ${sourceY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${targetX} ${targetY}`;
    labelX = 0.125 * sourceX + 0.375 * cp1X + 0.375 * cp2X + 0.125 * targetX;
    labelY = 0.125 * sourceY + 0.375 * cp1Y + 0.375 * cp2Y + 0.125 * targetY;
  } else {
    [path, labelX, labelY] = getSmoothStepPath({
      sourceX,
      sourceY,
      sourcePosition,
      targetX,
      targetY,
      targetPosition,
    });
  }

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
        path={path}
        markerEnd="url(#arrow-failure)"
        interactionWidth={20}
        className={selected ? "edge-selected" : ""}
        style={{
          ...style,
          strokeDasharray: selected ? "6 3" : undefined,
          strokeWidth: selected || isHovered ? 2.5 : 2,
          stroke:
            selected || isHovered
              ? "var(--primary)"
              : style?.stroke || "#DC2626",
          animation: selected ? "edge-dash 0.5s linear infinite" : undefined,
          transition: "stroke-width 0.2s, stroke 0.2s",
        }}
      />
      <EdgeLabelRenderer>
        <div
          style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: "all",
          }}
          className="nodrag nopan flex items-center gap-1.5"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
        >
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-500/10 border-red-500/30 text-red-500 shadow-sm">
            retry
          </span>
          {/* Delete button — hidden when running */}
          {!isRunning && (
            <button
              onClick={handleDelete}
              className={`h-8 w-8 flex items-center justify-center transition-all cursor-pointer group ${
                isHovered || selected
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-95 pointer-events-none"
              }`}
              aria-label="Delete edge"
            >
              <div
                className={`h-5 w-5 rounded-full flex items-center justify-center shadow-sm transition-colors ${
                  selected
                    ? "bg-destructive text-destructive-foreground hover:brightness-110"
                    : "bg-background text-muted-foreground border border-border group-hover:bg-destructive group-hover:text-destructive-foreground group-hover:brightness-110"
                }`}
              >
                <Trash2 className="h-3 w-3" />
              </div>
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </g>
  );
}
