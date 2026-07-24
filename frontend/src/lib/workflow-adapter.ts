import type {
  Workflow,
  BackendWorkflow,
  BackendWorkflowEdge,
} from '@/types/workflow';

/**
 * Convert a frontend Workflow to the backend's BackendWorkflow schema.
 *
 * The backend requires:
 * - `entryNode`: first node with no incoming edges
 * - nodes: only `id`, `type`, `config` (no `name`, `position`)
 * - edges: only `source`, `target`, `on` (no `id`, `label`, handles)
 */
export function toBackendWorkflow(workflow: Workflow): BackendWorkflow {
  // Find entry node: first node with no incoming edges
  const targets = new Set(workflow.edges.map((e) => e.target));
  const entryNode =
    workflow.nodes.find((n) => !targets.has(n.id))?.id ??
    workflow.nodes[0]?.id ??
    'input';

  // Convert nodes
  const nodes = workflow.nodes.map((n) => ({
    id: n.id,
    type: n.type,
    config: Object.keys(n.config).length > 0 ? n.config : undefined,
  }));

  // Convert edges — an explicit `outcome` (set on gate/decision branches)
  // wins over the visual edge `type`.
  const edges: BackendWorkflowEdge[] = workflow.edges.map((e) => ({
    source: e.source,
    target: e.target,
    on: e.outcome ?? edgeTypeToOn(e.type),
  }));

  return { entryNode, nodes, edges };
}

/**
 * Map frontend edge type to backend `on` field.
 *
 * - 'failure' → 'failure'
 * - 'success' | 'default' | undefined → 'success'
 */
function edgeTypeToOn(type: string | undefined): 'success' | 'failure' {
  return type === 'failure' ? 'failure' : 'success';
}
