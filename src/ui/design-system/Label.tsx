import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '@/shared/utils/cn';

export interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(({ className, ...props }, ref) => (
  // biome-ignore lint/a11y/noLabelWithoutControl: This is a generic UI primitive. htmlFor is provided by the consumer.
  <label
    ref={ref}
    className={cn(
      'text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-primary',
      className,
    )}
    {...props}
  />
));

Label.displayName = 'Label';
