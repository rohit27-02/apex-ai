'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { useUIStore } from '@/stores/ui-store';
import { PanelHeader } from '@/components/ui/panel';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { ConsoleEntry } from './console-entry';
import { ConsoleFilter } from './console-filter';
import { ChevronUp, ChevronDown } from 'lucide-react';
import type { RunEvent } from '@/types/run';

interface RunConsoleProps {
  events: RunEvent[];
}

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 600;

export function RunConsole({ events }: RunConsoleProps) {
  const consoleOpen = useUIStore((s) => s.consoleOpen);
  const toggleConsole = useUIStore((s) => s.toggleConsole);
  const consoleFilter = useUIStore((s) => s.consoleFilter);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState(200);

  const filteredEvents = consoleFilter
    ? events.filter((e) => e.nodeId === consoleFilter)
    : events;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredEvents.length]);

  // Drag the top edge to resize. Dragging up grows the console.
  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startY = e.clientY;
      const startHeight = height;
      const onMove = (ev: MouseEvent) => {
        const next = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, startHeight + (startY - ev.clientY)));
        setHeight(next);
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
        document.body.style.userSelect = '';
      };
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [height]
  );

  return (
    <div className="border-t border-border bg-panel">
      {consoleOpen && (
        <div
          onMouseDown={onResizeStart}
          role="separator"
          aria-orientation="horizontal"
          aria-label="Resize console"
          className="h-1.5 w-full cursor-ns-resize bg-transparent hover:bg-primary/40 transition-colors"
        />
      )}
      <PanelHeader
        className="px-4 py-2.5 cursor-pointer hover:bg-muted transition-colors"
        onClick={toggleConsole}
        role="button"
        tabIndex={0}
        aria-expanded={consoleOpen}
        aria-controls="run-console-content"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleConsole(); } }}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
            Console
          </span>
          {filteredEvents.length > 0 && (
            <Badge variant="default" className="text-[10px] px-1.5 py-0" aria-label={`${filteredEvents.length} events`}>
              {filteredEvents.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {consoleFilter && <ConsoleFilter />}
          {consoleOpen ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          ) : (
            <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
        </div>
      </PanelHeader>

      {consoleOpen && (
        <div
          id="run-console-content"
          className="border-t border-border"
          style={{ height }}
          role="log"
          aria-label="Run event log"
        >
          <ScrollArea className="h-full">
            <div className="p-2">
              {filteredEvents.length === 0 ? (
                <div className="flex items-center justify-center h-full min-h-25 text-xs text-muted-foreground font-mono" aria-live="polite">
                  Waiting for events...
                </div>
              ) : (
                <ul className="space-y-px" role="list">
                  {filteredEvents.map((event) => (
                    <ConsoleEntry key={event.id} event={event} />
                  ))}
                </ul>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
