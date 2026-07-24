'use client';

import { create } from 'zustand';
import {
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import type { Workflow, WorkflowNode, NodeType } from '@/types/workflow';
import { DEFAULT_WORKFLOW } from '@/constants/workflow';

interface WorkflowState {
  workflow: Workflow;
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  setWorkflow: (workflow: Workflow) => void;
  selectNode: (id: string | null) => void;
  updateNodeConfig: (id: string, config: Record<string, unknown>) => void;
  updateNodeLabel: (id: string, label: string) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  addNode: (type: NodeType, position: { x: number; y: number }) => void;
  insertNodeOnEdge: (type: NodeType, position: { x: number; y: number }, edgeId: string) => void;
  removeNode: (id: string) => void;
  removeEdge: (id: string) => void;
  onNodesChange: (changes: NodeChange<Node>[]) => void;
  onEdgesChange: (changes: EdgeChange<Edge>[]) => void;
  onConnect: (connection: Connection) => void;
  setEdgeOutcome: (edgeId: string, outcome: 'success' | 'failure') => void;
  resetToDefault: () => void;
  arrangeLayout: () => void;
}

const NODE_DEFAULTS: Record<NodeType, { name: string; config: Record<string, unknown> }> = {
  input: { name: 'New Input', config: { objective: '', constraints: [] } },
  agent: { name: 'New Agent', config: { model: '', instructions: '', tools: [] } },
  command: { name: 'New Command', config: { command: '', timeout: 60000 } },
  validator: { name: 'New Validator', config: { criteria: [], retryLimit: 3 } },
  decision: { name: 'New Decision', config: { condition: '' } },
  human_gate: { name: 'New Human Gate', config: { prompt: '', required: false } },
  success: { name: 'New Success', config: { message: 'Task complete.' } },
  stop: { name: 'New Stop', config: { reason: 'Stopped.' } },
};

let nodeCounter = 0;

function workflowToReactFlow(wf: Workflow): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = wf.nodes.map((n: WorkflowNode) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { label: n.name, config: n.config, nodeType: n.type },
  }));
  const edges: Edge[] = wf.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sourceHandle,
    targetHandle: e.targetHandle,
    label: e.label,
    type: e.type || 'default',
    animated: false,
    style: {
      stroke: e.type === 'failure' ? '#DC2626' : e.type === 'success' ? '#16A34A' : undefined,
    },
  }));
  return { nodes, edges };
}

const initial = workflowToReactFlow(DEFAULT_WORKFLOW);

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  workflow: DEFAULT_WORKFLOW,
  nodes: initial.nodes,
  edges: initial.edges,
  selectedNodeId: null,

  setWorkflow: (workflow) => {
    const { nodes, edges } = workflowToReactFlow(workflow);
    set({ workflow, nodes, edges });
  },

  resetToDefault: () => {
    const { nodes, edges } = workflowToReactFlow(DEFAULT_WORKFLOW);
    set({ workflow: DEFAULT_WORKFLOW, nodes, edges, selectedNodeId: null });
  },

  selectNode: (id) => set({ selectedNodeId: id }),

  updateNodeConfig: (id, config) =>
    set((state) => {
      const updatedNodes = state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, config } } : n
      );
      const updatedWorkflow = {
        ...state.workflow,
        nodes: state.workflow.nodes.map((n) =>
          n.id === id ? { ...n, config: config as typeof n.config } : n
        ),
        updatedAt: new Date().toISOString(),
      };
      return { nodes: updatedNodes, workflow: updatedWorkflow };
    }),

  updateNodeLabel: (id, label) =>
    set((state) => {
      const updatedNodes = state.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, label } } : n
      );
      const updatedWorkflow = {
        ...state.workflow,
        nodes: state.workflow.nodes.map((n) =>
          n.id === id ? { ...n, name: label } : n
        ),
        updatedAt: new Date().toISOString(),
      };
      return { nodes: updatedNodes, workflow: updatedWorkflow };
    }),

  updateNodePosition: (id, position) =>
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.id === id ? { ...n, position } : n
      ),
    })),

  addNode: (type, position) => {
    nodeCounter++;
    const defaults = NODE_DEFAULTS[type];
    const id = `${type}-${Date.now()}-${nodeCounter}`;

    const newNode: Node = {
      id,
      type,
      position,
      data: { label: defaults.name, config: defaults.config, nodeType: type },
    };

    const newWorkflowNode: WorkflowNode = {
      id,
      type,
      name: defaults.name,
      config: defaults.config,
      position,
    };

    set((state) => ({
      nodes: [...state.nodes, newNode],
      workflow: {
        ...state.workflow,
        nodes: [...state.workflow.nodes, newWorkflowNode],
        updatedAt: new Date().toISOString(),
      },
    }));
  },

  removeNode: (id) =>
    set((state) => {
      const newEdges = state.edges.filter(
        (e) => e.source !== id && e.target !== id
      );
      const newWorkflowEdges = state.workflow.edges.filter(
        (e) => e.source !== id && e.target !== id
      );
      return {
        nodes: state.nodes.filter((n) => n.id !== id),
        edges: newEdges,
        selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
        workflow: {
          ...state.workflow,
          nodes: state.workflow.nodes.filter((n) => n.id !== id),
          edges: newWorkflowEdges,
          updatedAt: new Date().toISOString(),
        },
      };
    }),

  removeEdge: (id) =>
    set((state) => ({
      edges: state.edges.filter((e) => e.id !== id),
      workflow: {
        ...state.workflow,
        edges: state.workflow.edges.filter((e) => e.id !== id),
        updatedAt: new Date().toISOString(),
      },
    })),

  onNodesChange: (changes) =>
    set((state) => ({
      nodes: applyNodeChanges(changes, state.nodes),
    })),

  onEdgesChange: (changes) =>
    set((state) => ({
      edges: applyEdgeChanges(changes, state.edges),
    })),

  onConnect: (connection) =>
    set((state) => {
      const srcNode = state.nodes.find((n) => n.id === connection.source);
      // Branching nodes (human_gate, decision) may have TWO outgoing edges
      // (approved/pass + rejected/fail), so they are exempt from the
      // one-edge-per-handle dedupe used for linear nodes.
      const isBranching = srcNode?.type === 'human_gate' || srcNode?.type === 'decision';

      const srcHandle = connection.sourceHandle ?? null;
      const sameHandle = (e: { source: string; sourceHandle?: string | null }) =>
        e.source === connection.source && (e.sourceHandle ?? null) === srcHandle;

      const keptEdges = isBranching ? state.edges : state.edges.filter((e) => !sameHandle(e));
      const keptWorkflowEdges = isBranching
        ? state.workflow.edges
        : state.workflow.edges.filter((e) => !sameHandle(e));

      // Default outcome for a branch: first edge = success (approved/pass),
      // a second edge from the same node defaults to failure (rejected/fail).
      let outcome: 'success' | 'failure' | undefined;
      if (isBranching) {
        const existingFromSrc = state.workflow.edges.filter((e) => e.source === connection.source);
        const hasSuccess = existingFromSrc.some((e) => (e.outcome ?? 'success') === 'success');
        outcome = hasSuccess ? 'failure' : 'success';
      }

      const newEdge: Edge = {
        ...connection,
        id: `e-${connection.source}-${connection.target}-${Date.now()}`,
        type: 'default',
        label: outcome === 'failure' ? 'rejected' : outcome === 'success' ? 'approved' : '',
        data: outcome ? { outcome } : undefined,
      };
      const newWorkflowEdge = {
        id: newEdge.id,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        label: (newEdge.label as string) ?? '',
        type: 'default' as const,
        outcome,
      };
      return {
        edges: addEdge(newEdge, keptEdges),
        workflow: {
          ...state.workflow,
          edges: [...keptWorkflowEdges, newWorkflowEdge],
          updatedAt: new Date().toISOString(),
        },
      };
    }),

  setEdgeOutcome: (edgeId, outcome) =>
    set((state) => {
      const label = outcome === 'failure' ? 'rejected' : 'approved';
      return {
        edges: state.edges.map((e) =>
          e.id === edgeId ? { ...e, label, data: { ...(e.data ?? {}), outcome } } : e
        ),
        workflow: {
          ...state.workflow,
          edges: state.workflow.edges.map((e) =>
            e.id === edgeId ? { ...e, outcome, label } : e
          ),
          updatedAt: new Date().toISOString(),
        },
      };
    }),

  insertNodeOnEdge: (type, position, edgeId) =>
    set((state) => {
      const edge = state.edges.find((e) => e.id === edgeId);
      if (!edge) return {};

      nodeCounter++;
      const defaults = NODE_DEFAULTS[type];
      const id = `${type}-${Date.now()}-${nodeCounter}`;

      const newNode: Node = {
        id,
        type,
        position,
        data: { label: defaults.name, config: defaults.config, nodeType: type },
      };
      const newWorkflowNode: WorkflowNode = { id, type, name: defaults.name, config: defaults.config, position };

      // Split source -> target into source -> new -> target (preserve edge type).
      const edgeType = (edge.type as 'default' | 'success' | 'failure') ?? 'default';
      const mk = (source: string, target: string): Edge => ({
        id: `e-${source}-${target}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        source,
        target,
        type: edgeType,
        label: '',
      });
      const inEdge = mk(edge.source, id);
      const outEdge = mk(id, edge.target);
      const toWf = (e: Edge) => ({
        id: e.id, source: e.source, target: e.target, label: '',
        type: edgeType,
      });

      const edges = state.edges.filter((e) => e.id !== edgeId).concat(inEdge, outEdge);
      const wfEdges = state.workflow.edges
        .filter((e) => e.id !== edgeId)
        .concat(toWf(inEdge), toWf(outEdge));

      return {
        nodes: [...state.nodes, newNode],
        edges,
        workflow: {
          ...state.workflow,
          nodes: [...state.workflow.nodes, newWorkflowNode],
          edges: wfEdges,
          updatedAt: new Date().toISOString(),
        },
      };
    }),

      arrangeLayout: () => {
    const dagreGraph = new dagre.graphlib.Graph();
    dagreGraph.setDefaultEdgeLabel(() => ({}));

    // Configure dagre layout
    dagreGraph.setGraph({ rankdir: 'LR', align: 'UL', nodesep: 60, ranksep: 100, edgesep: 30 });

    set((state) => {
      // Add nodes to dagre
      state.nodes.forEach((node) => {
        // Approximate width and height
        dagreGraph.setNode(node.id, { width: 240, height: 100 });
      });

      // Add edges to dagre
      state.edges.forEach((edge) => {
        dagreGraph.setEdge(edge.source, edge.target);
      });

      // Calculate layout
      dagre.layout(dagreGraph);

      // Apply positions
      const updatedNodes = state.nodes.map((n) => {
        const nodeWithPosition = dagreGraph.node(n.id);
        return {
          ...n,
          position: {
            // Adjust position so the top-left of the node is correctly placed.
            // Dagre calculates positions based on the center of the node.
            x: nodeWithPosition.x - 240 / 2,
            y: nodeWithPosition.y - 100 / 2,
          },
        };
      });

      return { nodes: updatedNodes };
    });
  },
}));
