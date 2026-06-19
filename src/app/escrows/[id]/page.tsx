'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';

import {
  useEscrow,
  type EscrowDeposit,
  type EscrowEvent,
  type EscrowParticipant,
} from '@/lib/escrows';
import { assetSymbol, fmtDate, truncateMiddle } from '@/lib/format';
import { useSession } from '@/lib/session';

export default function EscrowDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const session = useSession();
  const query = useEscrow(id);

  if (session.isLoading) return <Centered>Checking session…</Centered>;
  if (!session.data?.authenticated) {
    return (
      <Centered>
        <p className="text-sm text-neutral-600">
          You need to{' '}
          <Link href="/login" className="font-medium underline">
            sign in
          </Link>
          .
        </p>
      </Centered>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <Link href="/escrows" className="text-sm text-neutral-500 underline">
        ← All escrows
      </Link>

      {query.isLoading && (
        <p className="text-sm text-neutral-500">Loading escrow…</p>
      )}

      {query.error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This escrow doesn&apos;t exist, or it isn&apos;t in your access set.
        </div>
      )}

      {query.data && (
        <>
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold">
                {query.data.escrow.engagementId ?? 'Escrow'}
              </h1>
              <p
                className="text-xs text-neutral-500"
                title={query.data.escrow.contractId}
              >
                {query.data.escrow.contractType ?? 'unknown'} ·{' '}
                {truncateMiddle(query.data.escrow.contractId, 8, 6)}
              </p>
            </div>
            <Badge status={query.data.escrow.status} />
          </header>

          <Section title="Details">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <Field label="Network" value={query.data.escrow.network} />
              <Field
                label="Amount"
                value={
                  query.data.escrow.totalAmount
                    ? `${query.data.escrow.totalAmount} ${assetSymbol(query.data.escrow.asset)}`
                    : '—'
                }
              />
              <Field label="Asset" value={query.data.escrow.asset ?? '—'} mono />
              <Field
                label="Creator"
                value={
                  query.data.escrow.creatorAddress
                    ? truncateMiddle(query.data.escrow.creatorAddress)
                    : '—'
                }
                title={query.data.escrow.creatorAddress ?? undefined}
                mono
              />
              <Field
                label="Created"
                value={fmtDate(query.data.escrow.createdAt)}
              />
              <Field
                label="Updated"
                value={fmtDate(query.data.escrow.updatedAt)}
              />
            </dl>
          </Section>

          <Section title={`Participants (${query.data.participants.length})`}>
            {query.data.participants.length === 0 ? (
              <Empty>No participants recorded yet.</Empty>
            ) : (
              <ul className="divide-y divide-neutral-100 text-sm">
                {query.data.participants.map((p, i) => (
                  <ParticipantRow key={`${p.address}-${p.role}-${i}`} p={p} />
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Deposits (${query.data.deposits.length})`}>
            {query.data.deposits.length === 0 ? (
              <Empty>No deposits yet.</Empty>
            ) : (
              <ul className="divide-y divide-neutral-100 text-sm">
                {query.data.deposits.map((d) => (
                  <DepositRow key={d.id} d={d} />
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Timeline (${query.data.events.length})`}>
            {query.data.events.length === 0 ? (
              <Empty>No events yet.</Empty>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {query.data.events.map((e) => (
                  <EventRow key={e.id} e={e} />
                ))}
              </ul>
            )}
          </Section>

          {query.data.escrow.snapshot && (
            <details className="rounded-lg border border-neutral-200 bg-white p-4">
              <summary className="cursor-pointer select-none text-sm font-medium text-neutral-700">
                Raw snapshot
              </summary>
              <pre className="mt-3 max-h-96 overflow-auto rounded bg-neutral-50 p-3 text-xs">
                {JSON.stringify(query.data.escrow.snapshot, null, 2)}
              </pre>
            </details>
          )}
        </>
      )}
    </main>
  );
}

function ParticipantRow({ p }: { p: EscrowParticipant }) {
  return (
    <li className="flex items-center justify-between py-2">
      <span className="font-mono text-xs text-neutral-700" title={p.address}>
        {truncateMiddle(p.address)}
      </span>
      <span className="text-neutral-600">
        {p.role}
        {p.milestoneIndex >= 0 && (
          <span className="text-neutral-400"> · m{p.milestoneIndex}</span>
        )}
      </span>
    </li>
  );
}

function DepositRow({ d }: { d: EscrowDeposit }) {
  return (
    <li className="flex items-center justify-between py-2">
      <span className="font-mono text-xs text-neutral-700" title={d.fromAddress}>
        {truncateMiddle(d.fromAddress)}
      </span>
      <span className="text-neutral-700">
        {d.amount} {assetSymbol(d.asset)}
      </span>
      <span className="text-xs text-neutral-400">{fmtDate(d.ledgerClosedAt)}</span>
    </li>
  );
}

function EventRow({ e }: { e: EscrowEvent }) {
  return (
    <li className="rounded-md border border-neutral-100 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-neutral-800">{e.kind}</span>
        <span className="text-xs text-neutral-400">
          {fmtDate(e.ledgerClosedAt)}
        </span>
      </div>
      <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500">
        <span>ledger {e.ledgerSeq}</span>
        {e.actor && (
          <span className="font-mono" title={e.actor}>
            {truncateMiddle(e.actor)}
          </span>
        )}
        {e.txHash && (
          <span className="font-mono" title={e.txHash}>
            tx {truncateMiddle(e.txHash)}
          </span>
        )}
      </div>
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-medium text-neutral-700">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  mono,
  title,
}: {
  label: string;
  value: string;
  mono?: boolean;
  title?: string;
}) {
  return (
    <div>
      <dt className="text-xs text-neutral-400">{label}</dt>
      <dd
        className={`text-neutral-800 ${mono ? 'font-mono text-xs' : ''}`}
        title={title}
      >
        {value}
      </dd>
    </div>
  );
}

function Badge({ status }: { status: string | null }) {
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
    <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${tone}`}>
      {label}
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-neutral-400">{children}</p>;
}

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-8">
      {children}
    </main>
  );
}
