'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { Shell } from '@/components/shell';
import { useEscrows, type EscrowSummary } from '@/lib/escrows';
import { assetSymbol, truncateMiddle } from '@/lib/format';
import { useHasMounted } from '@/lib/use-has-mounted';
import { useSession } from '@/lib/session';

const STATUS_OPTIONS = [
  '',
  'ACTIVE',
  'FUNDED',
  'RELEASED',
  'DISPUTED',
  'RESOLVED',
];

export default function EscrowsPage() {
  const mounted = useHasMounted();
  const session = useSession();
  const [status, setStatus] = useState('');
  const escrows = useEscrows(status ? { status } : {});
  const authed = session.data?.authenticated ?? false;

  return (
    <Shell>
      {!mounted ? (
        <p className="text-sm text-neutral-500">Loading…</p>
      ) : !authed && !session.isLoading ? (
        <SignInPrompt />
      ) : (
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Escrows</h1>
              <p className="mt-1 text-sm text-neutral-500">
                Escrows your wallet participates in, plus any shared with you.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <select
                aria-label="Filter by status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="rounded-md border border-neutral-300 bg-white px-2 py-1.5 text-sm"
              >
                {STATUS_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s || 'All statuses'}
                  </option>
                ))}
              </select>
              <button
                onClick={() => escrows.refetch()}
                disabled={escrows.isFetching}
                className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm hover:bg-neutral-50 disabled:opacity-50"
              >
                {escrows.isFetching ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>

          {escrows.isLoading && (
            <p className="text-sm text-neutral-500">Loading escrows…</p>
          )}
          {escrows.error && <ErrorBox error={escrows.error} />}
          {escrows.data && escrows.data.length === 0 && <EmptyState />}
          {escrows.data && escrows.data.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {escrows.data.map((e) => (
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
        className="flex h-full flex-col gap-3 rounded-xl border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:shadow-sm"
      >
        <div className="flex items-start justify-between gap-2">
          <p className="min-w-0 truncate font-medium text-neutral-800">
            {escrow.engagementId ?? '(no engagement id)'}
          </p>
          <StatusBadge status={escrow.status} />
        </div>
        <div className="text-2xl font-semibold tracking-tight text-neutral-900">
          {escrow.totalAmount ? (
            <>
              {escrow.totalAmount}{' '}
              <span className="text-base font-normal text-neutral-400">
                {assetSymbol(escrow.asset)}
              </span>
            </>
          ) : (
            <span className="text-base font-normal text-neutral-400">
              no amount
            </span>
          )}
        </div>
        <div className="mt-auto flex items-center justify-between text-xs text-neutral-400">
          <span className="font-mono" title={escrow.contractId}>
            {truncateMiddle(escrow.contractId)}
          </span>
          <span>{escrow.contractType ?? 'unknown'}</span>
        </div>
      </Link>
    </li>
  );
}

export function StatusBadge({ status }: { status: string | null }) {
  const label = status ?? 'unknown';
  const tone =
    status === 'DISPUTED'
      ? 'bg-red-100 text-red-800'
      : status === 'RELEASED' || status === 'RESOLVED'
        ? 'bg-green-100 text-green-800'
        : status === 'FUNDED' || status === 'ACTIVE'
          ? 'bg-blue-100 text-blue-800'
          : 'bg-neutral-100 text-neutral-600';
  return (
    <span
      className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 p-10 text-center">
      <p className="text-sm text-neutral-600">No escrows yet.</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-neutral-400">
        New escrows appear here shortly after they&apos;re created — the
        read-model is fed by the indexer, so there can be a brief delay.
      </p>
    </div>
  );
}

function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {error instanceof Error ? error.message : 'Failed to load escrows.'}
    </div>
  );
}

function SignInPrompt(): ReactNode {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-10 text-center">
      <p className="text-sm text-neutral-600">
        Sign in with your wallet to view your escrows.
      </p>
      <Link
        href="/login"
        className="mt-3 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        Sign in
      </Link>
    </div>
  );
}
