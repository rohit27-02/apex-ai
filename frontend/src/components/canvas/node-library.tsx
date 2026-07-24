'use client';

import React from 'react';
import { NODE_LIBRARY_ITEMS } from '@/constants/workflow';
import { NODE_TYPE_CONFIG } from '@/constants/node-types';
import { cn } from '@/lib/utils';
import { Panel, PanelHeader, PanelContent } from '@/components/ui/panel';
import { GripVertical } from 'lucide-react';
import type { NodeType } from '@/types/workflow';

export function NodeLibrary() {
  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow-type', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Panel side="left" className="w-[240px] shrink-0">
      <PanelHeader>
        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
          Nodes
        </span>
      </PanelHeader>
      <PanelContent className="p-2">
        <nav aria-label="Available node types">
          <ul className="space-y-0.5" role="list">
            {NODE_LIBRARY_ITEMS.map((item) => {
              const config = NODE_TYPE_CONFIG[item.type];
              const Icon = config.icon;
              return (
                <li key={item.type}>
                  <div
                    draggable
                    onDragStart={(e) => onDragStart(e, item.type)}
                    role="button"
                    tabIndex={0}
                    aria-label={`Drag ${item.label} node to canvas`}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 cursor-grab active:cursor-grabbing',
                      'border border-transparent hover:border-border hover:bg-muted',
                      'transition-all duration-150 group'
                    )}
                  >
                    <GripVertical className="h-3 w-3 text-border group-hover:text-muted-foreground transition-colors" aria-hidden="true" />
                    <div
                      className="rounded-md p-1.5"
                      style={{ backgroundColor: `var(${config.bgVar})` }}
                      aria-hidden="true"
                    >
                      <span style={{ color: `var(${config.colorVar})` }}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      {item.label}
                    </span>
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>
      </PanelContent>
    </Panel>
  );
}
