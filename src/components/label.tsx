import React, { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface LabelProps extends HTMLAttributes<HTMLLabelElement> {
  htmlFor?: string;
}

export function Label({ htmlFor, className, ...props }: LabelProps) {
  return (
    <label
      htmlFor={htmlFor}
      className={cn(
        'text-sm font-medium text-zinc-700 dark:text-zinc-300',
        className
      )}
      {...props}
    />
  );
} 