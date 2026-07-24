'use client';

import React from 'react';
import { Badge } from '@/components/ui/badge';
import type { RunStatus as RunStatusType } from '@/types/run';
import { STATUS_LABELS } from '@/constants/status';

interface RunStatusProps {
  status: RunStatusType;
  attempt: number;
  maxAttempts: number;
}

const BADGE_VARIANT: Record<RunStatusType, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  idle: 'outline',
  running: 'default',
  success: 'secondary',
  failure: 'destructive',
  stopped: 'outline',
};

export function RunStatus({ status, attempt, maxAttempts }: RunStatusProps) {
  return (
    <div className="flex items-center gap-2.5" role="status" aria-label={`Status: ${STATUS_LABELS[status]}, attempt ${attempt} of ${maxAttempts}`}>
      <Badge variant={BADGE_VARIANT[status]}>
        {status === 'running' && (
          <span className="relative flex h-2 w-2 mr-1.5" aria-hidden="true">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
        )}
        {STATUS_LABELS[status]}
      </Badge>
      <span className="text-xs text-muted-foreground tabular-nums font-mono" aria-hidden="true">
        {attempt}/{maxAttempts}
      </span>
    </div>
  );
}
