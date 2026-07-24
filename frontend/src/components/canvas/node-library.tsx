'use client';

import React, { useState } from 'react';
import { NODE_LIBRARY_ITEMS } from '@/constants/workflow';
import { NODE_TYPE_CONFIG } from '@/constants/node-types';
import { cn } from '@/lib/utils';
import { Panel, PanelHeader, PanelContent } from '@/components/ui/panel';
import { GripVertical, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import type { NodeType } from '@/types/workflow';

export function NodeLibrary() {
  const [collapsed, setCollapsed] = useState(false);

  const onDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow-type', nodeType);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <Panel
      side="left"
      className={cn('shrink-0 transition-[width] duration-200', collapsed ? 'w-14' : 'w-60')}
    >
      <PanelHeader className={cn(collapsed && 'justify-center px-0')}>
        {!collapsed && (
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Nodes
          </span>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand node panel' : 'Collapse node panel'}
          title={collapsed ? 'Expand' : 'Collapse'}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {collapsed ? (
            <PanelLeftOpen className="h-4 w-4" aria-hidden="true" />
          ) : (
            <PanelLeftClose className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </PanelHeader>
      <PanelContent className={cn(collapsed ? 'p-1.5' : 'p-2')}>
        <nav aria-label="Available node types">
          <ul className={cn(collapsed ? 'space-y-1.5' : 'space-y-0.5')} role="list">
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
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      'flex items-center rounded-lg cursor-grab active:cursor-grabbing',
                      'border border-transparent hover:border-border hover:bg-muted',
                      'transition-all duration-150 group',
                      collapsed ? 'justify-center p-2' : 'gap-3 px-3 py-2.5'
                    )}
                  >
                    {!collapsed && (
                      <GripVertical
                        className="h-3 w-3 text-border group-hover:text-muted-foreground transition-colors"
                        aria-hidden="true"
                      />
                    )}
                    <div
                      className="rounded-md p-1.5"
                      style={{ backgroundColor: `var(${config.bgVar})` }}
                      aria-hidden="true"
                    >
                      <span style={{ color: `var(${config.colorVar})` }}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                    </div>
                    {!collapsed && (
                      <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        {item.label}
                      </span>
                    )}
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
