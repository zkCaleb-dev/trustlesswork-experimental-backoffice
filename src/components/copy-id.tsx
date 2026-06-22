'use client';

import { Check, Copy } from 'lucide-react';
import { useState } from 'react';

import { truncateMiddle } from '@/lib/format';
import { cn } from '@/lib/utils';

/**
 * A long id / address / asset shown as a middle-truncated monospace value with
 * a copy button. Never overflows its container: the value truncates and the
 * wrapper is `min-w-0 max-w-full`, so it fits any card/cell.
 */
export function CopyId({
  value,
  head = 6,
  tail = 4,
  full = false,
  className,
}: {
  value: string;
  head?: number;
  tail?: number;
  /** Show the full value (still truncates with ellipsis if it doesn't fit). */
  full?: boolean;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable — no-op */
    }
  }

  return (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-full items-center gap-1.5',
        className,
      )}
    >
      <span className="truncate font-mono text-xs" title={value}>
        {full ? value : truncateMiddle(value, head, tail)}
      </span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy'}
        className="shrink-0 text-muted-foreground/60 transition-colors hover:text-foreground"
      >
        {copied ? (
          <Check className="size-3.5 text-success" />
        ) : (
          <Copy className="size-3.5" />
        )}
      </button>
    </span>
  );
}
