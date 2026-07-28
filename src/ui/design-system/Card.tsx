import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('bg-surface border border-border rounded-lg shadow-sm', className)}
        {...props}
      >
        {children}
      </div>
    );
  },
);

Card.displayName = 'Card';
