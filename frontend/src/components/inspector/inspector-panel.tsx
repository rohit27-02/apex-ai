'use client';

import React, { useState } from 'react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { useUIStore } from '@/stores/ui-store';
import { NODE_TYPE_CONFIG } from '@/constants/node-types';
import { Panel, PanelHeader, PanelContent } from '@/components/ui/panel';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { X, Check, Ban } from 'lucide-react';
import { InputFields } from './fields/input-fields';
import { AgentFields } from './fields/agent-fields';
import { CommandFields } from './fields/command-fields';
import { ValidatorFields } from './fields/validator-fields';
import { DecisionFields } from './fields/decision-fields';
import { HumanGateFields } from './fields/human-gate-fields';
import type { Run } from '@/types/run';

interface InspectorPanelProps {
  run?: Run | null;
  waitingGateNodeId?: string | null;
  onApproveGate?: (nodeId: string, feedback?: string) => void;
  onRejectGate?: (nodeId: string, feedback?: string) => void;
}

function NodeNameField({ nodeId }: { nodeId: string }) {
  const node = useWorkflowStore((s) => s.nodes.find((n) => n.id === nodeId));
  const updateNodeLabel = useWorkflowStore((s) => s.updateNodeLabel);

  if (!node) return null;

  return (
    <div className="space-y-2 pb-4 border-b border-border">
      <Label htmlFor={`${nodeId}-name`}>Name</Label>
      <Input
        id={`${nodeId}-name`}
        value={(node.data.label as string) ?? ''}
        onChange={(e) => updateNodeLabel(nodeId, e.target.value)}
        placeholder="Node name"
      />
    </div>
  );
}

function HumanGateApproval({
  nodeId,
  onApprove,
  onReject,
}: {
  nodeId: string;
  onApprove: (feedback?: string) => void;
  onReject: (feedback?: string) => void;
}) {
  const [feedback, setFeedback] = useState('');

  return (
    <div className="space-y-4 p-4 bg-primary/5 border border-primary/20 rounded-lg">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
        <span className="text-sm font-semibold text-primary">Waiting for Approval</span>
      </div>
      <p className="text-xs text-muted-foreground">
        This node requires human approval before the workflow can continue.
      </p>
      <div className="space-y-2">
        <Label htmlFor="gate-feedback">Feedback (optional)</Label>
        <Textarea
          id="gate-feedback"
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Add feedback or instructions..."
          className="min-h-[60px] resize-none"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="default" onClick={() => onApprove(feedback || undefined)}>
          <Check className="h-3.5 w-3.5" />
          Approve
        </Button>
        <Button size="sm" variant="destructive" onClick={() => onReject(feedback || undefined)}>
          <Ban className="h-3.5 w-3.5" />
          Reject
        </Button>
      </div>
    </div>
  );
}

export function InspectorPanel({
  run,
  waitingGateNodeId,
  onApproveGate,
  onRejectGate,
}: InspectorPanelProps) {
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const nodes = useWorkflowStore((s) => s.nodes);
  const inspectorOpen = useUIStore((s) => s.inspectorOpen);
  const closeInspector = useUIStore((s) => s.closeInspector);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  if (!inspectorOpen || !selectedNode) return null;

  const nodeType = selectedNode.data.nodeType as string;
  const nodeConfig = NODE_TYPE_CONFIG[nodeType as keyof typeof NODE_TYPE_CONFIG];
  const isWaitingGate = waitingGateNodeId === selectedNode.id;

  return (
    <Panel side="right" className="w-[320px] shrink-0">
      <PanelHeader>
        <div className="flex items-center gap-2.5">
          {nodeConfig && (
            <div
              className="rounded-md p-1.5"
              style={{ backgroundColor: `var(${nodeConfig.bgVar})` }}
              aria-hidden="true"
            >
              <span style={{ color: `var(${nodeConfig.colorVar})` }}>
                <nodeConfig.icon className="h-3.5 w-3.5" />
              </span>
            </div>
          )}
          <div>
            <span className="text-sm font-semibold text-foreground block leading-tight">
              {selectedNode.data.label as string}
            </span>
            <span className="text-xs text-muted-foreground">{nodeConfig?.label}</span>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={closeInspector} className="h-8 w-8" aria-label="Close inspector">
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </PanelHeader>
      <PanelContent className="p-4">
        <div className="space-y-4">
          <NodeNameField nodeId={selectedNode.id} />

          {/* Human gate approval UI */}
          {isWaitingGate && onApproveGate && onRejectGate && (
            <HumanGateApproval
              nodeId={selectedNode.id}
              onApprove={(feedback) => onApproveGate(selectedNode.id, feedback)}
              onReject={(feedback) => onRejectGate(selectedNode.id, feedback)}
            />
          )}

          <InspectorFields nodeId={selectedNode.id} nodeType={nodeType} />
        </div>
      </PanelContent>
    </Panel>
  );
}

function InspectorFields({ nodeId, nodeType }: { nodeId: string; nodeType: string }) {
  switch (nodeType) {
    case 'input':
      return <InputFields nodeId={nodeId} />;
    case 'agent':
      return <AgentFields nodeId={nodeId} />;
    case 'command':
      return <CommandFields nodeId={nodeId} />;
    case 'validator':
      return <ValidatorFields nodeId={nodeId} />;
    case 'decision':
      return <DecisionFields nodeId={nodeId} />;
    case 'human_gate':
      return <HumanGateFields nodeId={nodeId} />;
    case 'success':
    case 'stop':
      return (
        <div className="text-xs text-muted-foreground py-4 text-center" role="status">
          Terminal node — no configurable settings.
        </div>
      );
    default:
      return null;
  }
}
