import * as React from 'react';
import { cn } from '@/lib/utils';

interface PanelProps extends React.HTMLAttributes<HTMLDivElement> {
  side: 'left' | 'right' | 'bottom';
}

const Panel = React.forwardRef<HTMLDivElement, PanelProps>(
  ({ className, side, children, ...props }, ref) => (
    <div
      ref={ref}
      role="complementary"
      className={cn(
        'flex flex-col bg-panel overflow-hidden',
        side === 'left' && 'border-r border-border',
        side === 'right' && 'border-l border-border',
        side === 'bottom' && 'border-t border-border',
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
);
Panel.displayName = 'Panel';

const PanelHeader = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('flex items-center justify-between px-4 py-3 border-b border-border', className)}
      {...props}
    />
  )
);
PanelHeader.displayName = 'PanelHeader';

const PanelContent = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('flex-1 overflow-y-auto', className)} role="region" {...props} />
  )
);
PanelContent.displayName = 'PanelContent';

export { Panel, PanelHeader, PanelContent };
