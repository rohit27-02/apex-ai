'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { downloadJson } from '@/lib/utils';

export function ExportButton() {
  const workflow = useWorkflowStore((s) => s.workflow);

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => downloadJson(workflow, `${workflow.name.replace(/\s+/g, '-').toLowerCase()}.json`)}
      aria-label="Export workflow as JSON"
    >
      <Download className="h-3.5 w-3.5" aria-hidden="true" />
      <span className="ml-0.5">Export</span>
    </Button>
  );
}
