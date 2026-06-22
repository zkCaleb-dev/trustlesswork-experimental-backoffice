'use client';

import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

import { Shell } from '@/components/shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useEscrows, type EscrowSummary } from '@/lib/escrows';
import { assetSymbol, formatAmount, truncateMiddle } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useHasMounted } from '@/lib/use-has-mounted';
import { cn } from '@/lib/utils';

const isStr = (s: string | null): s is string => s !== null && s !== '';

export default function EscrowsPage() {
  const mounted = useHasMounted();
  const session = useSession();
  const [status, setStatus] = useState('');
  const escrows = useEscrows();
  const authed = session.data?.authenticated ?? false;

  // Status values are derived from the actual data (the core stores them in its
  // own vocabulary, e.g. lowercase "active"), so the filter always matches.
  const all = escrows.data ?? [];
  const statuses = [...new Set(all.map((e) => e.status).filter(isStr))].sort();
  const filtered = status ? all.filter((e) => e.status === status) : all;

  return (
    <Shell>
      {!mounted ? (
        <EscrowsSkeleton />
      ) : !authed && !session.isLoading ? (
        <SignInPrompt />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Escrows</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Escrows your wallet participates in, plus any shared with you.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Filter by status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                disabled={statuses.length === 0}
                className="h-9 rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50"
              >
                <option value="">All statuses</option>
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => escrows.refetch()}
                disabled={escrows.isFetching}
              >
                <RefreshCw
                  className={cn('size-4', escrows.isFetching && 'animate-spin')}
                />
                {escrows.isFetching ? 'Refreshing…' : 'Refresh'}
              </Button>
            </div>
          </div>

          {escrows.isLoading && <EscrowsSkeleton bare />}
          {escrows.error && <ErrorBox error={escrows.error} />}
          {escrows.data && all.length === 0 && <EmptyState />}
          {all.length > 0 && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No escrows match “{status}”.
            </p>
          )}
          {filtered.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {filtered.map((e) => (
                <EscrowCard key={e.id} escrow={e} />
              ))}
            </ul>
          )}
        </div>
      )}
    </Shell>
  );
}

function EscrowCard({ escrow }: { escrow: EscrowSummary }) {
  return (
    <li>
      <Link
        href={`/escrows/${escrow.id}`}
        className="group flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm transition-colors hover:border-ring/40 hover:bg-accent/30"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate font-medium">
            {escrow.engagementId ?? '(no engagement id)'}
          </p>
          <StatusBadge status={escrow.status} />
        </div>
        {escrow.totalAmount ? (
          <div className="flex min-w-0 items-baseline gap-2">
            <span
              className="shrink-0 text-2xl font-semibold tracking-tight"
              title={escrow.totalAmount ?? undefined}
            >
              {formatAmount(escrow.totalAmount)}
            </span>
            {escrow.asset && (
              <span
                className="min-w-0 truncate text-sm font-normal text-muted-foreground"
                title={escrow.asset}
              >
                {assetSymbol(escrow.asset)}
              </span>
            )}
          </div>
        ) : (
          <div className="text-base font-normal text-muted-foreground">
            no amount
          </div>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate font-mono" title={escrow.contractId}>
            {truncateMiddle(escrow.contractId, 6, 6)}
          </span>
          <span className="shrink-0">{escrow.contractType ?? 'unknown'}</span>
        </div>
      </Link>
    </li>
  );
}

export function StatusBadge({ status }: { status: string | null }) {
  const s = (status ?? '').toUpperCase();
  const variant =
    s === 'DISPUTED'
      ? 'destructive'
      : s === 'RELEASED' || s === 'RESOLVED'
        ? 'success'
        : s === 'FUNDED' || s === 'ACTIVE'
          ? 'info'
          : 'secondary';
  return (
    <Badge variant={variant} className="shrink-0 capitalize">
      {status ?? 'unknown'}
    </Badge>
  );
}

function EscrowsSkeleton({ bare = false }: { bare?: boolean }) {
  const grid = (
    <ul className="grid gap-3 sm:grid-cols-2">
      {Array.from({ length: 4 }).map((_, i) => (
        <li key={i}>
          <div className="flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center justify-between gap-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <Skeleton className="h-8 w-24" />
            <Skeleton className="mt-auto h-3 w-40" />
          </div>
        </li>
      ))}
    </ul>
  );
  if (bare) return grid;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      {grid}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed p-10 text-center">
      <p className="text-sm font-medium">No escrows yet.</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">
        New escrows appear here shortly after they&apos;re created — the
        read-model is fed by the indexer, so there can be a brief delay.
      </p>
    </div>
  );
}

function ErrorBox({ error }: { error: unknown }) {
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="text-sm text-destructive">
        {error instanceof Error ? error.message : 'Failed to load escrows.'}
      </CardContent>
    </Card>
  );
}

function SignInPrompt() {
  return (
    <div className="rounded-xl border bg-card p-10 text-center shadow-sm">
      <p className="text-sm text-muted-foreground">
        Sign in with your wallet to view your escrows.
      </p>
      <Button asChild className="mt-4">
        <Link href="/login">Sign in</Link>
      </Button>
    </div>
  );
}
