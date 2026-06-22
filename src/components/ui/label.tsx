import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Minimal label primitive (no Radix dependency). Associate with an input via
 * `htmlFor`/`id` for accessibility.
 */
function Label({ className, ...props }: React.ComponentProps<'label'>) {
  return (
    <label
      data-slot="label"
      className={cn(
        'flex items-center gap-2 text-sm leading-none font-medium select-none peer-disabled:cursor-not-allowed peer-disabled:opacity-50',
        className,
      )}
      {...props}
    />
  );
}

export { Label };
