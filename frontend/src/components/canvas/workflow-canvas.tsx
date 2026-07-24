'use client';

import React, { useCallback, useMemo, useRef } from 'react';
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  type NodeTypes,
  type EdgeTypes,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useWorkflowStore } from '@/stores/workflow-store';
import { useUIStore } from '@/stores/ui-store';
import {
  InputNode,
  AgentNode,
  CommandNode,
  ValidatorNode,
  DecisionNode,
  HumanGateNode,
  SuccessNode,
  StopNode,
} from './nodes/base-node';
import { LoopEdge } from './edges/loop-edge';
import { SelectableEdge } from './edges/selectable-edge';
import type { NodeType } from '@/types/workflow';

const nodeTypes: NodeTypes = {
  input: InputNode,
  agent: AgentNode,
  command: CommandNode,
  validator: ValidatorNode,
  decision: DecisionNode,
  human_gate: HumanGateNode,
  success: SuccessNode,
  stop: StopNode,
};

const edgeTypes: EdgeTypes = {
  default: SelectableEdge,
  success: SelectableEdge,
  failure: LoopEdge,
};

interface WorkflowCanvasProps {
  run?: { nodeStates?: Record<string, { status: string }> } | null;
  waitingGateNodeId?: string | null;
  onApproveGate?: (nodeId: string, feedback?: string) => void;
  onRejectGate?: (nodeId: string, feedback?: string) => void;
}

export function WorkflowCanvas({ run, waitingGateNodeId }: WorkflowCanvasProps) {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const addNode = useWorkflowStore((s) => s.addNode);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const removeEdge = useWorkflowStore((s) => s.removeEdge);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const openInspector = useUIStore((s) => s.openInspector);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const reactFlowInstance = useRef<ReactFlowInstance | null>(null);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id);
      openInspector();
    },
    [selectNode, openInspector]
  );

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  const onEdgeDoubleClick = useCallback(
    (_: React.MouseEvent, edge: { id: string }) => {
      removeEdge(edge.id);
    },
    [removeEdge]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    reactFlowInstance.current = instance;
  }, []);

  // Drop handler — add node from library
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();

      const type = event.dataTransfer.getData('application/reactflow-type') as NodeType;
      if (!type || !reactFlowInstance.current || !reactFlowWrapper.current) return;

      const bounds = reactFlowWrapper.current.getBoundingClientRect();
      const position = reactFlowInstance.current.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      addNode(type, position);
    },
    [addNode]
  );

  // Delete selected elements on Backspace/Delete
  const onDelete = useCallback(
    (params: { nodes: { id: string }[]; edges: { id: string }[] }) => {
      params.nodes.forEach((n) => removeNode(n.id));
      params.edges.forEach((e) => removeEdge(e.id));
    },
    [removeNode, removeEdge]
  );

  const defaultViewport = useMemo(() => ({ x: 0, y: 0, zoom: 0.8 }), []);

  return (
    <div ref={reactFlowWrapper} className="w-full h-full" style={{ background: 'var(--canvas-bg)' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onInit={onInit}
        onDragOver={onDragOver}
        onDrop={onDrop}
        onDelete={onDelete}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        defaultViewport={defaultViewport}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        connectionRadius={40}
        minZoom={0.3}
        maxZoom={2}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode="Shift"
        proOptions={{ hideAttribution: true }}
        aria-label="Workflow canvas"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={2} color="var(--canvas-dot)" />
        <Controls
          showInteractive={false}
          aria-label="Canvas zoom controls"
        />
        <MiniMap
          aria-label="Canvas minimap"
        />
      </ReactFlow>
    </div>
  );
}
