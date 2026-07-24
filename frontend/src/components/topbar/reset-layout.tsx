'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { LayoutGrid } from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflow-store';

export function ArrangeLayoutButton() {
  const arrangeLayout = useWorkflowStore((s) => s.arrangeLayout);

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={arrangeLayout}
      aria-label="Arrange nodes in clean layout"
      title="Arrange layout"
    >
      <LayoutGrid className="h-4 w-4" aria-hidden="true" />
    </Button>
  );
}
