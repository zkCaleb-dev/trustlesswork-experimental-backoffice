'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Shell } from '@/components/shell';
import { useEscrowAction } from '@/lib/escrow-actions';
import {
  useEscrow,
  type EscrowDeposit,
  type EscrowEvent,
  type EscrowParticipant,
} from '@/lib/escrows';
import { assetSymbol, fmtDate, truncateMiddle } from '@/lib/format';
import { useHasMounted } from '@/lib/use-has-mounted';
import { useSession } from '@/lib/session';

export default function EscrowDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const mounted = useHasMounted();
  const session = useSession();
  const query = useEscrow(id);
  const authed = session.data?.authenticated ?? false;

  return (
    <Shell>
      <Link href="/escrows" className="text-sm text-neutral-500 hover:underline">
        ← All escrows
      </Link>

      {mounted && !authed && !session.isLoading && (
        <p className="mt-6 text-sm text-neutral-600">
          Please{' '}
          <Link href="/login" className="font-medium underline">
            sign in
          </Link>
          .
        </p>
      )}

      {authed && query.isLoading && (
        <p className="mt-6 text-sm text-neutral-500">Loading escrow…</p>
      )}

      {authed && query.error && (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          This escrow doesn&apos;t exist, or it isn&apos;t in your access set.
        </div>
      )}

      {authed && query.data && (
        <div className="mt-6 flex flex-col gap-6">
          <header className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight">
                {query.data.escrow.engagementId ?? 'Escrow'}
              </h1>
              <p
                className="mt-1 font-mono text-xs text-neutral-500"
                title={query.data.escrow.contractId}
              >
                {query.data.escrow.contractType ?? 'unknown'} ·{' '}
                {truncateMiddle(query.data.escrow.contractId, 8, 6)}
              </p>
            </div>
            <Badge status={query.data.escrow.status} />
          </header>

          <Section title="Details">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
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

          <Section title="Actions">
            <ActionsPanel
              escrowId={id}
              contractId={query.data.escrow.contractId}
              contractType={query.data.escrow.contractType}
            />
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
            <details className="rounded-xl border border-neutral-200 bg-white p-4">
              <summary className="cursor-pointer select-none text-sm font-medium text-neutral-700">
                Raw snapshot
              </summary>
              <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-neutral-50 p-3 text-xs">
                {JSON.stringify(query.data.escrow.snapshot, null, 2)}
              </pre>
            </details>
          )}
        </div>
      )}
    </Shell>
  );
}

function ActionsPanel({
  escrowId,
  contractId,
  contractType,
}: {
  escrowId: string;
  contractId: string;
  contractType: string | null;
}) {
  const action = useEscrowAction(escrowId);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');

  if (contractType !== 'single-release-v2') {
    return (
      <Empty>
        On-chain actions for “{contractType ?? 'unknown'}” escrows are coming
        soon. (Single-release v2 is supported.)
      </Empty>
    );
  }

  const base = '/escrow/single-release/v2';
  const busy = action.isPending;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-neutral-500">
        Each action builds an unsigned transaction, you approve it in your
        wallet, and it&apos;s submitted on-chain. You must use a wallet with the
        right role for the action.
      </p>

      {/* Fund */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">Amount to fund</span>
          <input
            value={amount}
            inputMode="decimal"
            placeholder="100"
            onChange={(e) => setAmount(e.target.value)}
            className="w-32 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <ActionButton
          disabled={busy || !amount || Number(amount) <= 0}
          onClick={() =>
            action.mutate(
              {
                buildPath: `${base}/fund`,
                bodyFor: (signer) => ({
                  contractId,
                  signer,
                  amount: Number(amount),
                }),
              },
              { onSuccess: () => setAmount('') },
            )
          }
        >
          Fund
        </ActionButton>

        <div className="ml-auto" />

        <ActionButton
          variant="primary"
          disabled={busy}
          onClick={() =>
            action.mutate({
              buildPath: `${base}/release-funds`,
              bodyFor: (signer) => ({ contractId, releaseSigner: signer }),
            })
          }
        >
          Release funds
        </ActionButton>
      </div>

      {/* Dispute */}
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs text-neutral-400">Dispute reason</span>
          <input
            value={reason}
            maxLength={500}
            placeholder="Why are you opening a dispute?"
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <ActionButton
          variant="danger"
          disabled={busy || !reason.trim()}
          onClick={() =>
            action.mutate(
              {
                buildPath: `${base}/dispute`,
                bodyFor: (signer) => ({ contractId, signer, reason }),
              },
              { onSuccess: () => setReason('') },
            )
          }
        >
          Open dispute
        </ActionButton>
      </div>

      {action.isPending && (
        <p className="text-xs text-neutral-500">
          Building, signing &amp; submitting — approve the transaction in your
          wallet…
        </p>
      )}
      {action.error && (
        <p className="text-xs text-red-600">
          {action.error instanceof Error
            ? action.error.message
            : 'The action failed.'}
        </p>
      )}
      {action.isSuccess && (
        <p className="text-xs text-green-700">
          Submitted ✓
          {action.data?.txHash
            ? ` · tx ${truncateMiddle(action.data.txHash)}`
            : ''}
          . The escrow updates shortly (indexer) — hit refresh on the list.
        </p>
      )}
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = 'secondary',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger';
}) {
  const styles =
    variant === 'primary'
      ? 'bg-neutral-900 text-white hover:bg-neutral-800'
      : variant === 'danger'
        ? 'border border-red-300 text-red-700 hover:bg-red-50'
        : 'border border-neutral-300 text-neutral-800 hover:bg-neutral-50';
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-md px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${styles}`}
    >
      {children}
    </button>
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
    <li className="flex items-center justify-between gap-3 py-2">
      <span className="font-mono text-xs text-neutral-700" title={d.fromAddress}>
        {truncateMiddle(d.fromAddress)}
      </span>
      <span className="text-neutral-700">
        {d.amount} {assetSymbol(d.asset)}
      </span>
      <span className="text-xs text-neutral-400">
        {fmtDate(d.ledgerClosedAt)}
      </span>
    </li>
  );
}

function EventRow({ e }: { e: EscrowEvent }) {
  return (
    <li className="rounded-lg border border-neutral-100 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="font-medium text-neutral-800">{e.kind}</span>
        <span className="text-xs text-neutral-400">
          {fmtDate(e.ledgerClosedAt)}
        </span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
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
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
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
        className={`text-neutral-800 ${mono ? 'truncate font-mono text-xs' : ''}`}
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
    <span
      className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${tone}`}
    >
      {label}
    </span>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-neutral-400">{children}</p>;
}
