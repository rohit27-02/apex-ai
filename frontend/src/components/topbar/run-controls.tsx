'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Square, Pause, X } from 'lucide-react';
import type { RunStatus as RunStatusType } from '@/types/run';
import type { RunScenario } from '@/lib/demo-runner';
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

export function RunControls({ status, onStart, onStop, backendAvailable }: RunControlsProps) {
  const isRunning = status === 'running';
  const [showDialog, setShowDialog] = useState(false);
  const [objective, setObjective] = useState('');
  const [scenario, setScenario] = useState<RunScenario>('success');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showDialog && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showDialog]);

  const handleRunClick = () => {
    setShowDialog(true);
    setObjective('');
    setScenario('success');
  };

  const handleConfirm = () => {
    if (objective.trim()) {
      onStart?.(objective.trim(), backendAvailable === false ? scenario : undefined);
      setShowDialog(false);
      setObjective('');
      setScenario('success');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    } else if (e.key === 'Escape') {
      setShowDialog(false);
    }
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

      {/* Objective input dialog */}
      {showDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-xl p-6 w-[480px] shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-foreground">Coding Objective</h2>
              <button
                onClick={() => setShowDialog(false)}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
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
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                variant="default"
                onClick={handleConfirm}
                disabled={!objective.trim()}
              >
                <Play className="h-3.5 w-3.5" fill="currentColor" />
                Start Run
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
