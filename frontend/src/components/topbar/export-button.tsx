'use client';

import React, { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflow-store';
import { downloadJson } from '@/lib/utils';
import type { Workflow } from '@/types/workflow';

export function ExportButton() {
  const workflow = useWorkflowStore((s) => s.workflow);
  const setWorkflow = useWorkflowStore((s) => s.setWorkflow);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target?.result as string) as Workflow;
        // Basic validation: must have nodes and edges arrays
        if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
          alert('Invalid workflow file: missing nodes or edges');
          return;
        }
        setWorkflow(data);
      } catch {
        alert('Failed to parse workflow file');
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be re-imported
    e.target.value = '';
  };

  return (
    <div className="flex items-center gap-1">
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={handleImport}
        aria-label="Import workflow file"
      />
      <Button
        size="sm"
        variant="outline"
        onClick={() => fileInputRef.current?.click()}
        aria-label="Import workflow from JSON"
      >
        <Upload className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="ml-0.5">Import</span>
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={() => downloadJson(workflow, `${workflow.name.replace(/\s+/g, '-').toLowerCase()}.json`)}
        aria-label="Export workflow as JSON"
      >
        <Download className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="ml-0.5">Export</span>
      </Button>
    </div>
  );
}
