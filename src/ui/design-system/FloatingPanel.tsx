import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';
import { Card } from './Card';

export interface FloatingPanelProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
}

export const FloatingPanel = forwardRef<HTMLDivElement, FloatingPanelProps>(
  ({ className, title, children, ...props }, ref) => {
    return (
      <Card
        ref={ref}
        className={cn('flex flex-col w-64 shadow-lg absolute z-50 overflow-hidden', className)}
        {...props}
      >
        {title && (
          <div className="px-4 py-3 border-b border-border bg-background/50 backdrop-blur-sm">
            <h3 className="text-sm font-semibold text-primary">{title}</h3>
          </div>
        )}
        <div className="p-4 flex flex-col gap-4">{children}</div>
      </Card>
    );
  },
);

FloatingPanel.displayName = 'FloatingPanel';
