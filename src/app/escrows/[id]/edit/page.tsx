'use client';

import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import {
  EscrowForm,
  type EscrowFormInitial,
  type EscrowFormSubmit,
} from '@/components/escrow-form';
import { Shell } from '@/components/shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { deriveEscrowKind, type EscrowKind } from '@/lib/escrow-action-registry';
import { useEscrowAction } from '@/lib/escrow-actions';
import { useEscrow } from '@/lib/escrows';
import { useHasMounted } from '@/lib/use-has-mounted';

const TOKEN_DECIMALS = 7;

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function strList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((x): x is string => typeof x === 'string') : [];
}

/** i128 stroops (decimal string) -> human units, no thousands separators. */
function stroopsToHuman(value: unknown): string {
  const s = String(value ?? '').trim();
  if (!/^\d+$/.test(s)) return '';
  const padded = s.padStart(TOKEN_DECIMALS + 1, '0');
  const intPart = padded.slice(0, -TOKEN_DECIMALS).replace(/^0+(?=\d)/, '');
  const frac = padded.slice(-TOKEN_DECIMALS).replace(/0+$/, '');
  return frac ? `${intPart}.${frac}` : intPart;
}

/** Maps a v2 snapshot to the form's initial values (snake_case -> form fields). */
function snapshotToInitial(
  kind: EscrowKind,
  snapshot: Record<string, unknown>,
): EscrowFormInitial {
  const multi = kind === 'multi-release-v2';
  const roles = asRecord(snapshot.roles);
  const milestones = Array.isArray(snapshot.milestones)
    ? snapshot.milestones
    : [];

  return {
    type: multi ? 'mr-v2' : 'sr-v2',
    engagementId: str(snapshot.engagement_id),
    title: str(snapshot.title),
    description: str(snapshot.description),
    amount: multi ? '' : stroopsToHuman(snapshot.amount),
    platformFee:
      snapshot.platform_fee != null ? String(snapshot.platform_fee) : '0',
    receiverMemo:
      snapshot.receiver_memo != null ? String(snapshot.receiver_memo) : '',
    trustlineContractId: str(asRecord(snapshot.trustline).address),
    approvers: strList(roles.approvers),
    serviceProviders: strList(roles.service_providers),
    releaseSigners: strList(roles.release_signers),
    disputeResolvers: strList(roles.dispute_resolvers),
    observers: strList(roles.observers),
    platform: str(roles.platform),
    receiver: multi ? '' : str(roles.receiver),
    admin: str(roles.admin),
    milestones: milestones.length
      ? milestones.map((raw) => {
          const m = asRecord(raw);
          return {
            description: str(m.description),
            amount: multi ? stroopsToHuman(m.amount) : '',
            receiver: multi ? str(m.receiver) : '',
            status: str(m.status) || 'pending',
            approvalsTarget: '1',
            evidence: '',
          };
        })
      : undefined,
  };
}

export default function EditEscrowPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const mounted = useHasMounted();
  const query = useEscrow(id);
  const action = useEscrowAction(id);

  const escrow = query.data?.escrow;
  const kind = deriveEscrowKind(
    escrow?.contractType ?? null,
    escrow?.snapshot ?? null,
  );
  const flavor = kind === 'multi-release-v2' ? 'multi-release' : 'single-release';
  const busy = action.isSubmitting || action.isConfirming;

  const onSubmit = (payload: EscrowFormSubmit) => {
    if (!escrow) return;
    action.run({
      buildPath: `/escrow/${flavor}/v2/update`,
      method: 'PUT',
      bodyFor: (signer) => ({
        contractId: escrow.contractId,
        admin: signer,
        escrow: payload.fields,
      }),
    });
  };

  return (
    <Shell>
      <div className="flex flex-col gap-6">
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="-ml-2 w-fit text-muted-foreground"
        >
          <Link href={`/escrows/${id}`}>
            <ArrowLeft className="size-4" />
            Back to escrow
          </Link>
        </Button>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Edit escrow</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Update the escrow properties. Signed by the admin wallet. On-chain
            milestones and runtime state are preserved.
          </p>
        </div>

        {!mounted || query.isLoading ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Loading…
            </CardContent>
          </Card>
        ) : !escrow || !kind ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              This escrow isn&apos;t available, or its state hasn&apos;t been
              indexed yet.
            </CardContent>
          </Card>
        ) : kind.endsWith('-v1') ? (
          <Card>
            <CardContent className="text-sm text-muted-foreground">
              Editing is only supported for v2 escrows.
            </CardContent>
          </Card>
        ) : (
          <>
            <EscrowForm
              mode="edit"
              initial={snapshotToInitial(kind, escrow.snapshot ?? {})}
              submitting={busy}
              submitLabel="Save changes"
              submittingLabel="Saving…"
              error={
                action.error
                  ? action.error instanceof Error
                    ? action.error.message
                    : 'The update failed.'
                  : null
              }
              onSubmit={onSubmit}
            />

            {action.isConfirming && (
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Waiting for the network to reflect it…
              </p>
            )}
            {action.confirm === 'confirmed' && (
              <p className="flex items-center gap-2 text-sm text-success">
                Saved ✓
                <Link
                  href={`/escrows/${id}`}
                  className="inline-flex items-center gap-1 font-medium underline"
                >
                  View escrow
                  <ArrowRight className="size-4" />
                </Link>
              </p>
            )}
            {action.confirm === 'timeout' && (
              <p className="text-sm text-muted-foreground">
                Submitted — taking longer than usual to appear; it&apos;ll update
                on its own shortly.
              </p>
            )}
          </>
        )}
      </div>
    </Shell>
  );
}
