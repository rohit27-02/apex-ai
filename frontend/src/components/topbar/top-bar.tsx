'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { RunControls } from './run-controls';
import { RunStatus } from './run-status';
import { ExportButton } from './export-button';
import { ThemeToggle } from './theme-toggle';
import { SettingsModal } from './settings-modal';
import { ArrangeLayoutButton } from './reset-layout';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import type { Run } from '@/types/run';
import type { RunScenario } from '@/lib/demo-runner';

interface TopBarProps {
  run?: Run | null;
  onStart?: (objective: string, scenario?: RunScenario) => void;
  onStop?: () => void;
  backendAvailable?: boolean;
}

export function TopBar({ run, onStart, onStop, backendAvailable }: TopBarProps) {
  return (
    <header
      className="h-14 border-b border-border bg-panel flex items-center justify-between px-5 shrink-0"
      role="banner"
    >
      {/* Left: branding */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2.5">
          <img
            src="/telekom-logo.png"
            alt=""
            className="h-8 w-8 object-contain"
            aria-hidden="true"
          />
          <div className="flex flex-col">
            <span className="text-sm font-bold text-foreground tracking-tight leading-none">
              Apex AI
            </span>
            <span className="text-[10px] text-primary font-semibold tracking-wider uppercase">
              Deutsche Telekom
            </span>
          </div>
        </div>
        <Separator orientation="vertical" className="h-6" aria-hidden="true" />
        <span className="text-xs text-muted-foreground font-medium">
          Autonomous Coding Loop
        </span>
      </div>

      {/* Center: run controls + status */}
      <nav className="flex items-center gap-4" aria-label="Run controls">
        <RunControls
          status={run?.status ?? 'idle'}
          onStart={onStart}
          onStop={onStop}
          backendAvailable={backendAvailable}
        />
        {run && (
          <>
            <Separator orientation="vertical" className="h-6" aria-hidden="true" />
            <RunStatus
              status={run.status}
              attempt={run.attempt}
              maxAttempts={run.maxAttempts}
            />
          </>
        )}
      </nav>

      {/* Right: actions */}
      <div className="flex items-center gap-1" role="toolbar" aria-label="Actions">
        {backendAvailable === false && (
          <Badge variant="outline" className="text-[10px] mr-2">
            Demo Mode
          </Badge>
        )}
        <ArrangeLayoutButton />
        <SettingsModal />
        <ThemeToggle />
        <Separator orientation="vertical" className="h-6 mx-1" aria-hidden="true" />
        <ExportButton />
      </div>
    </header>
  );
}
