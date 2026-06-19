'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { useEscrows, type EscrowSummary } from '@/lib/escrows';
import { assetSymbol, fmtDate, truncateMiddle } from '@/lib/format';
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
  const session = useSession();
  const [status, setStatus] = useState('');
  const escrows = useEscrows(status ? { status } : {});

  if (session.isLoading) {
    return <Centered>Checking session…</Centered>;
  }
  if (!session.data?.authenticated) {
    return (
      <Centered>
        <p className="text-sm text-neutral-600">
          You need to{' '}
          <Link href="/login" className="font-medium underline">
            sign in
          </Link>{' '}
          to view your escrows.
        </p>
      </Centered>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Escrows</h1>
          <p className="text-sm text-neutral-500">
            Escrows your wallet participates in, plus any shared with you.
          </p>
        </div>
        <Link href="/" className="text-sm text-neutral-500 underline">
          Home
        </Link>
      </header>

      <div className="flex items-center gap-2">
        <label className="text-sm text-neutral-600" htmlFor="status">
          Status
        </label>
        <select
          id="status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-md border border-neutral-300 px-2 py-1 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s || 'All'}
            </option>
          ))}
        </select>
        <button
          onClick={() => escrows.refetch()}
          disabled={escrows.isFetching}
          className="ml-auto rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
        >
          {escrows.isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {escrows.isLoading && (
        <p className="text-sm text-neutral-500">Loading escrows…</p>
      )}
      {escrows.error && <ErrorBox error={escrows.error} />}
      {escrows.data && escrows.data.length === 0 && <EmptyState />}
      {escrows.data && escrows.data.length > 0 && (
        <ul className="flex flex-col gap-3">
          {escrows.data.map((e) => (
            <EscrowRow key={e.id} escrow={e} />
          ))}
        </ul>
      )}
    </main>
  );
}

function EscrowRow({ escrow }: { escrow: EscrowSummary }) {
  return (
    <li>
      <Link
        href={`/escrows/${escrow.id}`}
        className="block rounded-lg border border-neutral-200 bg-white p-4 transition hover:border-neutral-300 hover:shadow-sm"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate font-medium text-neutral-800">
              {escrow.engagementId ?? '(no engagement id)'}
            </p>
            <p className="text-xs text-neutral-500" title={escrow.contractId}>
              {escrow.contractType ?? 'unknown'} ·{' '}
              {truncateMiddle(escrow.contractId)}
            </p>
          </div>
          <StatusBadge status={escrow.status} />
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-neutral-700">
            {escrow.totalAmount
              ? `${escrow.totalAmount} ${assetSymbol(escrow.asset)}`
              : '—'}
          </span>
          <span className="text-xs text-neutral-400">
            updated {fmtDate(escrow.updatedAt)}
          </span>
        </div>
      </Link>
    </li>
  );
}

function StatusBadge({ status }: { status: string | null }) {
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
    <div className="rounded-lg border border-dashed border-neutral-300 p-8 text-center">
      <p className="text-sm text-neutral-600">No escrows yet.</p>
      <p className="mt-1 text-xs text-neutral-400">
        New escrows appear here shortly after they&apos;re created — the
        read-model is fed by the indexer, so there can be a brief delay.
      </p>
    </div>
  );
}

function ErrorBox({ error }: { error: unknown }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
      {error instanceof Error ? error.message : 'Failed to load escrows.'}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-8">
      {children}
    </main>
  );
}
