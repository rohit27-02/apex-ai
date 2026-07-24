'use client';

import React from 'react';
import { useUIStore } from '@/stores/ui-store';
import { useWorkflowStore } from '@/stores/workflow-store';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';

export function ConsoleFilter() {
  const consoleFilter = useUIStore((s) => s.consoleFilter);
  const setConsoleFilter = useUIStore((s) => s.setConsoleFilter);
  const nodes = useWorkflowStore((s) => s.nodes);

  if (!consoleFilter) return null;

  const node = nodes.find((n) => n.id === consoleFilter);
  const label = (node?.data?.label as string) ?? consoleFilter;

  return (
    <button
      onClick={(e: React.MouseEvent) => { e.stopPropagation(); setConsoleFilter(null); }}
      className="inline-flex items-center gap-1"
    >
      <Badge variant="default" className="gap-1 cursor-pointer">
        <span>{label}</span>
        <X className="h-3 w-3" aria-hidden="true" />
      </Badge>
    </button>
  );
}
