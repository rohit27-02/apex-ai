'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Play, Square, Pause, X, ChevronRight, Pencil, Check } from 'lucide-react';
import type { RunStatus as RunStatusType } from '@/types/run';
import type { RunScenario } from '@/lib/demo-runner';
import { useWorkflowStore } from '@/stores/workflow-store';
import { cn } from '@/lib/utils';

interface RunControlsProps {
  status: RunStatusType;
  onStart?: (objective: string, scenario?: RunScenario) => void;
  onStop?: () => void;
  backendAvailable?: boolean;
}

const SCENARIOS: { value: RunScenario; label: string; description: string }[] = [
  { value: 'success', label: 'Success', description: 'All criteria pass, human approves' },
  { value: 'failure', label: 'Failure', description: 'Validation fails after retries' },
  { value: 'human_gate', label: 'Human Gate', description: 'Waits for reviewer approval' },
];

interface EditableCriterion {
  id: string;
  description: string;
  command: string;
}

export function RunControls({ status, onStart, onStop, backendAvailable }: RunControlsProps) {
  const isRunning = status === 'running';
  const [showDialog, setShowDialog] = useState(false);
  const [objective, setObjective] = useState('');
  const [scenario, setScenario] = useState<RunScenario>('success');
  const [step, setStep] = useState<'objective' | 'criteria'>('objective');
  const [criteria, setCriteria] = useState<EditableCriterion[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showDialog && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showDialog]);

  // Extract criteria from the criteria agent node's config
  const configuredCriteria = useMemo(() => {
    const nodes = useWorkflowStore.getState().nodes;
    const criteriaNode = nodes.find(
      (n) => (n.data?.nodeType === 'agent' && (n.data?.config as Record<string, unknown>)?.role === 'criteria')
        || n.id === 'criteria',
    );
    const config = (criteriaNode?.data?.config as Record<string, unknown>) ?? {};
    const raw = config.criteria as { id: string; description: string; command: string }[] | undefined;
    return raw ?? [];
  }, []);

  const hasCriteria = configuredCriteria.length > 0;

  const handleRunClick = () => {
    const nodes = useWorkflowStore.getState().nodes;
    const inputNode = nodes.find((n) => n.data?.nodeType === 'input' || n.type === 'input');
    const nodeObjective = ((inputNode?.data?.config as { objective?: string })?.objective ?? '').trim();

    if (nodeObjective && backendAvailable !== false) {
      onStart?.(nodeObjective);
      return;
    }

    setObjective(nodeObjective);
    setScenario('success');
    setCriteria(configuredCriteria.map((c) => ({ ...c })));
    setStep('objective');
    setShowDialog(true);
  };

  const handleObjectiveConfirm = () => {
    if (!objective.trim()) return;
    setStep('criteria');
  };

  const handleFinalConfirm = () => {
    if (objective.trim()) {
      // Update the input node's objective with what the user typed
      const nodes = useWorkflowStore.getState().nodes;
      const inputNode = nodes.find((n) => n.data?.nodeType === 'input' || n.type === 'input');
      if (inputNode) {
        const config = { ...(inputNode.data.config as Record<string, unknown>), objective: objective.trim() };
        useWorkflowStore.getState().updateNodeConfig(inputNode.id, config);
      }
      // Update criteria node config with edited criteria
      if (criteria.length > 0) {
        const criteriaNode = nodes.find(
          (n) => (n.data?.nodeType === 'agent' && (n.data?.config as Record<string, unknown>)?.role === 'criteria')
            || n.id === 'criteria',
        );
        if (criteriaNode) {
          const config = { ...(criteriaNode.data.config as Record<string, unknown>), criteria };
          useWorkflowStore.getState().updateNodeConfig(criteriaNode.id, config);
        }
      }
      onStart?.(objective.trim(), backendAvailable === false ? scenario : undefined);
      setShowDialog(false);
      setObjective('');
      setScenario('success');
      setStep('objective');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (step === 'objective') handleObjectiveConfirm();
      else handleFinalConfirm();
    } else if (e.key === 'Escape') {
      setShowDialog(false);
    }
  };

  const updateCriterion = (id: string, field: 'description' | 'command', value: string) => {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  };

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Run controls">
      {!isRunning ? (
        <Button size="sm" variant="default" onClick={handleRunClick} aria-label="Start run">
          <Play className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true" />
          <span className="ml-0.5">Run</span>
        </Button>
      ) : (
        <>
          <Button size="sm" variant="outline" aria-label="Pause run" disabled>
            <Pause className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button size="sm" variant="destructive" onClick={onStop} aria-label="Stop run">
            <Square className="h-3 w-3" fill="currentColor" aria-hidden="true" />
            <span className="ml-0.5">Stop</span>
          </Button>
        </>
      )}

      {/* Run dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 w-[520px] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">
                  {step === 'objective' ? 'Coding Objective' : 'Review Success Criteria'}
                </h2>
                {hasCriteria && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className={cn('px-1.5 py-0.5 rounded', step === 'objective' ? 'bg-primary/10 text-primary' : 'bg-muted')}>
                      1
                    </span>
                    <ChevronRight className="h-3 w-3" />
                    <span className={cn('px-1.5 py-0.5 rounded', step === 'criteria' ? 'bg-primary/10 text-primary' : 'bg-muted')}>
                      2
                    </span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowDialog(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Step 1: Objective */}
            {step === 'objective' && (
              <>
                <p className="text-xs text-muted-foreground mb-4">
                  Describe what you want the AI coding loop to accomplish.
                </p>
                <Input
                  ref={inputRef}
                  value={objective}
                  onChange={(e) => setObjective(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="e.g., Add error handling to the API layer"
                  className="mb-4"
                />

                {/* Scenario selector — only in demo mode */}
                {backendAvailable === false && (
                  <div className="mb-4">
                    <label className="text-xs text-muted-foreground font-medium mb-2 block">
                      Demo Scenario
                    </label>
                    <div className="flex gap-2">
                      {SCENARIOS.map((s) => (
                        <button
                          key={s.value}
                          onClick={() => setScenario(s.value)}
                          className={cn(
                            'flex-1 px-3 py-2 rounded-lg text-xs font-medium border transition-colors cursor-pointer',
                            scenario === s.value
                              ? 'bg-primary/10 border-primary text-primary'
                              : 'bg-muted border-border text-muted-foreground hover:text-foreground',
                          )}
                          title={s.description}
                        >
                          {s.label}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5">
                      {SCENARIOS.find((s) => s.value === scenario)?.description}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setShowDialog(false)}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="default"
                    onClick={handleObjectiveConfirm}
                    disabled={!objective.trim()}
                  >
                    Next <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
                  </Button>
                </div>
              </>
            )}

            {/* Step 2: Criteria review */}
            {step === 'criteria' && (
              <>
                <p className="text-xs text-muted-foreground mb-4">
                  {criteria.length > 0
                    ? 'Review and edit the success criteria. The validator will check these after each attempt.'
                    : 'The Success Criteria Agent will generate measurable criteria from your objective during the run. You can review them in the inspector panel.'}
                </p>
                <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto">
                  {criteria.length === 0 && (
                    <div className="rounded-lg border border-dashed border-border px-3 py-4 text-center">
                      <p className="text-xs text-muted-foreground">
                        Criteria will be generated by the agent
                      </p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">
                        The agent will analyze your objective and create testable checks
                      </p>
                    </div>
                  )}
                  {criteria.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-lg border border-border px-3 py-2.5 bg-muted/30"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="text-[10px] shrink-0">
                          {c.id}
                        </Badge>
                        {editingId === c.id ? (
                          <Input
                            autoFocus
                            value={c.description}
                            onChange={(e) => updateCriterion(c.id, 'description', e.target.value)}
                            onBlur={() => setEditingId(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingId(null)}
                            className="h-6 text-xs border-none bg-transparent px-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          />
                        ) : (
                          <span className="flex-1 text-xs text-foreground">{c.description}</span>
                        )}
                        <button
                          onClick={() => setEditingId(editingId === c.id ? null : c.id)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {editingId === c.id ? (
                            <Check className="h-3 w-3" />
                          ) : (
                            <Pencil className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        $ {c.command}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setStep('objective')}>
                    Back
                  </Button>
                  <Button size="sm" variant="default" onClick={handleFinalConfirm}>
                    <Play className="h-3.5 w-3.5" fill="currentColor" />
                    Start Run
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
