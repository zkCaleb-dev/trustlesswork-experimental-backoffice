'use client';

import { ArrowLeft, Loader2, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { CopyId } from '@/components/copy-id';
import { Shell } from '@/components/shell';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useEscrowAction } from '@/lib/escrow-actions';
import {
  actionsForKind,
  actionsForState,
  deriveEscrowKind,
  initialValues,
  roleLabel,
  walletRoles,
  type ActionInput,
  type ActionValues,
  type DistributionRow,
  type StatusUpdateRow,
  type EscrowActionDef,
  type EscrowKind,
  type EscrowStatus,
} from '@/lib/escrow-action-registry';
import {
  useEscrow,
  type EscrowDeposit,
  type EscrowEvent,
  type EscrowParticipant,
} from '@/lib/escrows';
import { assetSymbol, fmtDate, formatAmount, truncateMiddle } from '@/lib/format';
import { useSession } from '@/lib/session';
import { useHasMounted } from '@/lib/use-has-mounted';

export default function EscrowDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const mounted = useHasMounted();
  const session = useSession();
  const query = useEscrow(id);
  const authed = session.data?.authenticated ?? false;

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 w-fit text-muted-foreground"
        >
          <Link href="/escrows">
            <ArrowLeft className="size-4" />
            All escrows
          </Link>
        </Button>

        {!mounted || (authed && query.isLoading) ? (
          <DetailSkeleton />
        ) : !authed && !session.isLoading ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Please{' '}
              <Link href="/login" className="font-medium text-foreground underline">
                sign in
              </Link>{' '}
              to view this escrow.
            </CardContent>
          </Card>
        ) : authed && query.error ? (
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="text-sm text-foreground">
              This escrow doesn&apos;t exist, or it isn&apos;t in your access set.
            </CardContent>
          </Card>
        ) : authed && query.data ? (
          <>
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-semibold tracking-tight">
                  {query.data.escrow.engagementId ?? 'Escrow'}
                </h1>
                <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                  <span className="shrink-0">
                    {query.data.escrow.contractType ?? 'unknown'}
                  </span>
                  <span className="shrink-0">·</span>
                  <CopyId
                    value={query.data.escrow.contractId}
                    head={8}
                    tail={6}
                  />
                </div>
              </div>
              <StatusBadge status={query.data.escrow.status} />
            </header>

            <Section title="Details">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                <Field label="Network">
                  <Plain>{query.data.escrow.network}</Plain>
                </Field>
                <Field label="Amount">
                  <Plain>
                    {query.data.escrow.totalAmount
                      ? `${formatAmount(query.data.escrow.totalAmount)} ${assetSymbol(query.data.escrow.asset)}`
                      : '—'}
                  </Plain>
                </Field>
                <Field label="Asset">
                  {query.data.escrow.asset ? (
                    <CopyId value={query.data.escrow.asset} head={8} tail={6} />
                  ) : (
                    <Plain muted>—</Plain>
                  )}
                </Field>
                <Field label="Contract">
                  <CopyId
                    value={query.data.escrow.contractId}
                    head={8}
                    tail={6}
                  />
                </Field>
                <Field label="Creator">
                  {query.data.escrow.creatorAddress ? (
                    <CopyId value={query.data.escrow.creatorAddress} />
                  ) : (
                    <Plain muted>—</Plain>
                  )}
                </Field>
                <Field label="Created">
                  <Plain>{fmtDate(query.data.escrow.createdAt)}</Plain>
                </Field>
                <Field label="Updated">
                  <Plain>{fmtDate(query.data.escrow.updatedAt)}</Plain>
                </Field>
              </dl>
            </Section>

            <Section title="Actions">
              <ActionsPanel
                escrowId={id}
                contractId={query.data.escrow.contractId}
                contractType={query.data.escrow.contractType}
                status={query.data.escrow.status}
                snapshot={query.data.escrow.snapshot}
                participants={query.data.participants}
                myWallet={session.data?.wallet ?? null}
              />
            </Section>

            <Section title={`Participants (${query.data.participants.length})`}>
              {query.data.participants.length === 0 ? (
                <Empty>No participants recorded yet.</Empty>
              ) : (
                <ul className="divide-y divide-border">
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
                <ul className="divide-y divide-border">
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
                <ul className="flex flex-col gap-2">
                  {query.data.events.map((e) => (
                    <EventRow key={e.id} e={e} />
                  ))}
                </ul>
              )}
            </Section>

            {query.data.escrow.snapshot && (
              <details className="rounded-xl border bg-card p-4 shadow-sm">
                <summary className="cursor-pointer text-sm font-medium select-none">
                  Raw snapshot
                </summary>
                <pre className="mt-3 max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs">
                  {JSON.stringify(query.data.escrow.snapshot, null, 2)}
                </pre>
              </details>
            )}
          </>
        ) : null}
      </div>
    </Shell>
  );
}

function ActionsPanel({
  escrowId,
  contractId,
  contractType,
  status,
  snapshot,
  participants,
  myWallet,
}: {
  escrowId: string;
  contractId: string;
  contractType: string | null;
  status: string | null;
  snapshot: Record<string, unknown> | null;
  participants: EscrowParticipant[];
  myWallet: string | null;
}) {
  const action = useEscrowAction(escrowId);
  const kind = deriveEscrowKind(contractType, snapshot);
  const busy = action.isSubmitting || action.isConfirming;

  if (!kind) {
    return (
      <Empty>
        Actions appear once the escrow&apos;s on-chain state has been indexed.
      </Empty>
    );
  }
  if (kind.endsWith('-v1')) {
    return (
      <Empty>
        On-chain actions for v1 escrows aren&apos;t available here yet — v1 is
        frozen; v2 is supported.
      </Empty>
    );
  }

  const myRoles = walletRoles(participants, myWallet);
  const available = actionsForState(
    actionsForKind(kind),
    status as EscrowStatus | null,
  );

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-muted-foreground">
        Each action builds an unsigned transaction, you approve it in your
        wallet, and it&apos;s submitted on-chain. Only the actions your role and
        the escrow&apos;s state allow are shown.
      </p>

      {available.length === 0 ? (
        <Empty>
          No actions available while the escrow is “{status ?? 'unknown'}”.
        </Empty>
      ) : (
        <div className="flex flex-col divide-y divide-border">
          {available.map((def) => (
            <ActionRow
              key={def.key}
              def={def}
              kind={kind}
              contractId={contractId}
              action={action}
              busy={busy}
              myRoles={myRoles}
            />
          ))}
        </div>
      )}

      {myRoles.has('admin') && (
        <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
          <span className="text-xs text-muted-foreground">Admin</span>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/escrows/${escrowId}/milestones`}>
              Manage milestones
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/escrows/${escrowId}/edit`}>Edit escrow</Link>
          </Button>
        </div>
      )}

      {action.isSubmitting && (
        <p className="text-xs text-muted-foreground">
          Building, signing &amp; submitting — approve the transaction in your
          wallet…
        </p>
      )}
      {action.isConfirming && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" />
          Submitted
          {action.data?.txHash
            ? ` · tx ${truncateMiddle(action.data.txHash)}`
            : ''}{' '}
          — waiting for the network to reflect it…
        </p>
      )}
      {action.confirm === 'confirmed' && (
        <p className="text-xs text-success">
          Done ✓
          {action.data?.txHash
            ? ` · tx ${truncateMiddle(action.data.txHash)}`
            : ''}{' '}
          — the escrow is up to date.
        </p>
      )}
      {action.confirm === 'timeout' && (
        <p className="text-xs text-muted-foreground">
          Submitted
          {action.data?.txHash
            ? ` · tx ${truncateMiddle(action.data.txHash)}`
            : ''}
          . Taking longer than usual to appear — it&apos;ll update on its own
          shortly.
        </p>
      )}
      {action.error && (
        <p className="text-xs text-destructive">
          {action.error instanceof Error
            ? action.error.message
            : 'The action failed.'}
        </p>
      )}
    </div>
  );
}

function ActionRow({
  def,
  kind,
  contractId,
  action,
  busy,
  myRoles,
}: {
  def: EscrowActionDef;
  kind: EscrowKind;
  contractId: string;
  action: ReturnType<typeof useEscrowAction>;
  busy: boolean;
  myRoles: Set<string>;
}) {
  const [values, setValues] = useState<ActionValues>(() => initialValues(def));
  const roleOk =
    !def.requiredRoles || def.requiredRoles.every((r) => myRoles.has(r));
  const ready = def.isReady ? def.isReady(values) : true;

  const submit = () =>
    action.run(
      {
        buildPath: def.path(kind),
        bodyFor: (signer) => def.buildBody({ contractId, signer, values }),
      },
      { onSuccess: () => setValues(initialValues(def)) },
    );

  return (
    <div className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">{def.label}</span>
        {def.requiredRoles && (
          <span className="text-xs text-muted-foreground">
            signs as {def.requiredRoles.map(roleLabel).join(' + ')}
          </span>
        )}
      </div>
      {def.inputs?.map((input) => (
        <ActionInputField
          key={input.name}
          input={input}
          value={values[input.name]}
          onChange={(v) => setValues((prev) => ({ ...prev, [input.name]: v }))}
        />
      ))}
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant={def.tone === 'default' ? undefined : def.tone}
          disabled={busy || !roleOk || !ready}
          onClick={submit}
        >
          {def.label}
        </Button>
        {!roleOk && def.requiredRoles && (
          <span className="text-xs text-muted-foreground">
            Connect a wallet with role:{' '}
            {def.requiredRoles.map(roleLabel).join(' + ')}.
          </span>
        )}
      </div>
    </div>
  );
}

function ActionInputField({
  input,
  value,
  onChange,
}: {
  input: ActionInput;
  value: ActionValues[string] | undefined;
  onChange: (value: ActionValues[string]) => void;
}) {
  if (input.kind === 'amount') {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{input.label}</Label>
        <Input
          value={typeof value === 'string' ? value : ''}
          inputMode="decimal"
          placeholder={input.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-40"
        />
      </div>
    );
  }
  if (input.kind === 'text') {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{input.label}</Label>
        <Input
          value={typeof value === 'string' ? value : ''}
          maxLength={input.maxLength}
          placeholder={input.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  if (input.kind === 'indexes') {
    return (
      <div className="flex flex-col gap-1.5">
        <Label>{input.label}</Label>
        <Input
          value={typeof value === 'string' ? value : ''}
          placeholder={input.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className="w-48"
        />
      </div>
    );
  }
  if (input.kind === 'statusUpdates') {
    const rows = (Array.isArray(value) ? value : []) as StatusUpdateRow[];
    return (
      <div className="flex flex-col gap-2">
        <Label>{input.label}</Label>
        {rows.map((row, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Input
              value={row.index}
              inputMode="numeric"
              placeholder="index"
              className="w-20"
              onChange={(e) =>
                onChange(
                  rows.map((r, j) =>
                    j === i ? { ...r, index: e.target.value } : r,
                  ),
                )
              }
            />
            <Input
              value={row.status}
              placeholder="status (e.g. completed)"
              className="min-w-0 flex-1"
              onChange={(e) =>
                onChange(
                  rows.map((r, j) =>
                    j === i ? { ...r, status: e.target.value } : r,
                  ),
                )
              }
            />
            <Input
              value={row.evidence}
              placeholder="evidence (optional)"
              className="min-w-0 flex-1"
              onChange={(e) =>
                onChange(
                  rows.map((r, j) =>
                    j === i ? { ...r, evidence: e.target.value } : r,
                  ),
                )
              }
            />
            {rows.length > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove update"
                onClick={() => onChange(rows.filter((_, j) => j !== i))}
              >
                <Trash2 className="size-4" />
              </Button>
            )}
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit text-muted-foreground"
          onClick={() =>
            onChange([...rows, { index: '', status: '', evidence: '' }])
          }
        >
          <Plus className="size-4" />
          Add milestone update
        </Button>
      </div>
    );
  }

  const rows = (Array.isArray(value) ? value : []) as DistributionRow[];
  return (
    <div className="flex flex-col gap-2">
      <Label>{input.label}</Label>
      {rows.map((row, i) => (
        <div key={i} className="flex items-center gap-2">
          <Input
            value={row.address}
            placeholder="G… recipient"
            className="min-w-0 flex-1 font-mono text-xs"
            onChange={(e) =>
              onChange(
                rows.map((r, j) =>
                  j === i ? { ...r, address: e.target.value } : r,
                ),
              )
            }
          />
          <Input
            value={row.amount}
            inputMode="decimal"
            placeholder="amount"
            className="w-28"
            onChange={(e) =>
              onChange(
                rows.map((r, j) =>
                  j === i ? { ...r, amount: e.target.value } : r,
                ),
              )
            }
          />
          {rows.length > 1 && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove recipient"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              <Trash2 className="size-4" />
            </Button>
          )}
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit text-muted-foreground"
        onClick={() => onChange([...rows, { address: '', amount: '' }])}
      >
        <Plus className="size-4" />
        Add recipient
      </Button>
    </div>
  );
}

function ParticipantRow({ p }: { p: EscrowParticipant }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <CopyId value={p.address} className="min-w-0 flex-1" />
      <span className="shrink-0 text-sm text-muted-foreground">
        {p.role}
        {p.milestoneIndex >= 0 && (
          <span className="text-muted-foreground/60"> · m{p.milestoneIndex}</span>
        )}
      </span>
    </li>
  );
}

function DepositRow({ d }: { d: EscrowDeposit }) {
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <CopyId value={d.fromAddress} className="min-w-0 flex-1" />
      <span className="shrink-0 text-sm">
        {formatAmount(d.amount)} {assetSymbol(d.asset)}
      </span>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:inline">
        {fmtDate(d.ledgerClosedAt)}
      </span>
    </li>
  );
}

function EventRow({ e }: { e: EscrowEvent }) {
  return (
    <li className="rounded-lg border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{e.kind}</span>
        <span className="shrink-0 text-xs text-muted-foreground">
          {fmtDate(e.ledgerClosedAt)}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="shrink-0">ledger {e.ledgerSeq}</span>
        {e.actor && <CopyId value={e.actor} />}
        {e.txHash && (
          <span className="inline-flex min-w-0 items-center gap-1">
            tx <CopyId value={e.txHash} />
          </span>
        )}
      </div>
    </li>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

function Plain({ children, muted }: { children: ReactNode; muted?: boolean }) {
  return (
    <span
      className={`block truncate text-sm${muted ? ' text-muted-foreground' : ''}`}
    >
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
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

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function DetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-5 w-20 rounded-md" />
      </div>
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
