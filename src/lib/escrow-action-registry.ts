/**
 * Declarative registry of on-chain escrow actions.
 *
 * Each action declares which escrow kind it applies to, the lifecycle states
 * it is offered in, the participant role that must sign it, its input fields,
 * and how to build the request body. The ActionsPanel renders this — adding an
 * action is a data change here, not new UI.
 *
 * The read-model exposes contractType as the FLAVOR only (single-release /
 * multi-release), never the version. The version is derived from the snapshot
 * shape: v2 carries role lists (roles.approvers[]), v1 a single roles.approver.
 */

export type EscrowKind =
  | 'single-release-v1'
  | 'single-release-v2'
  | 'multi-release-v1'
  | 'multi-release-v2';

/** Snapshot-derived lifecycle status (see the core snapshot interpreter). */
export type EscrowStatus = 'active' | 'released' | 'disputed';

/** Participant role strings as returned by the read-model. */
export type ParticipantRole =
  | 'admin'
  | 'platform'
  | 'receiver'
  | 'approver'
  | 'release_signer'
  | 'service_provider'
  | 'dispute_resolver'
  | 'observer';

export interface DistributionRow {
  address: string;
  amount: string;
}

/** Per-action form state (string for scalars, rows for distributions). */
export type ActionValues = Record<string, string | DistributionRow[]>;

export type ActionInput =
  | { kind: 'amount'; name: string; label: string; placeholder?: string }
  | {
      kind: 'text';
      name: string;
      label: string;
      placeholder?: string;
      maxLength?: number;
    }
  | { kind: 'distributions'; name: string; label: string };

export interface BuildContext {
  contractId: string;
  signer: string;
  values: ActionValues;
}

export interface EscrowActionDef {
  key: string;
  label: string;
  /** Escrow kinds this action applies to. */
  kinds: EscrowKind[];
  /** Lifecycle states the action is offered in (omit = any state). */
  states?: EscrowStatus[];
  /**
   * Participant role that must sign. Used to (a) gate by the connected
   * wallet's roles and (b) tell the user which wallet to connect. Omit for
   * actions anyone can call (e.g. fund, open dispute).
   */
  requiredRole?: ParticipantRole;
  tone?: 'default' | 'secondary' | 'destructive';
  inputs?: ActionInput[];
  /** Endpoint that builds the unsigned tx, per kind. */
  path: (kind: EscrowKind) => string;
  /** True when the current inputs are enough to submit. */
  isReady?: (values: ActionValues) => boolean;
  /** Assembles the request body sent to the build endpoint. */
  buildBody: (ctx: BuildContext) => Record<string, unknown>;
}

// ── kind / role derivation ──────────────────────────────────────────────────

function snapshotVersion(
  snapshot: Record<string, unknown> | null,
): 'v1' | 'v2' | null {
  const roles =
    snapshot && typeof snapshot === 'object'
      ? (snapshot as { roles?: unknown }).roles
      : null;
  if (!roles || typeof roles !== 'object') return null;
  // v2 carries role lists (approvers[]); v1 has a single `approver`.
  return Array.isArray((roles as { approvers?: unknown }).approvers)
    ? 'v2'
    : 'v1';
}

/**
 * Resolves the full kind from the read-model contractType (flavor) + the
 * snapshot (version). Returns null while the snapshot hasn't been indexed yet.
 */
export function deriveEscrowKind(
  contractType: string | null,
  snapshot: Record<string, unknown> | null,
): EscrowKind | null {
  const version = snapshotVersion(snapshot);
  if (!version) return null;
  if (contractType === 'single-release') return `single-release-${version}`;
  if (contractType === 'multi-release') return `multi-release-${version}`;
  return null;
}

/** Roles the given wallet holds in this escrow, from the participant list. */
export function walletRoles(
  participants: ReadonlyArray<{ address: string; role: string }>,
  wallet: string | null,
): Set<string> {
  if (!wallet) return new Set();
  return new Set(
    participants.filter((p) => p.address === wallet).map((p) => p.role),
  );
}

/** Human label for a role, e.g. release_signer -> "release signer". */
export function roleLabel(role: ParticipantRole): string {
  return role.replace(/_/g, ' ');
}

/** Initial form state for an action's declared inputs. */
export function initialValues(def: EscrowActionDef): ActionValues {
  const out: ActionValues = {};
  for (const input of def.inputs ?? []) {
    out[input.name] =
      input.kind === 'distributions' ? [{ address: '', amount: '' }] : '';
  }
  return out;
}

// ── registry ──────────────────────────────────────────────────────────────

const SINGLE_RELEASE_V2: EscrowActionDef[] = [
  {
    key: 'fund',
    label: 'Fund',
    kinds: ['single-release-v2'],
    states: ['active'],
    tone: 'default',
    inputs: [
      { kind: 'amount', name: 'amount', label: 'Amount to fund', placeholder: '100' },
    ],
    path: () => '/escrow/single-release/v2/fund',
    isReady: (v) => Number(v.amount) > 0,
    buildBody: ({ contractId, signer, values }) => ({
      contractId,
      signer,
      amount: Number(values.amount),
    }),
  },
  {
    key: 'release',
    label: 'Release funds',
    kinds: ['single-release-v2'],
    states: ['active'],
    requiredRole: 'release_signer',
    tone: 'secondary',
    path: () => '/escrow/single-release/v2/release-funds',
    buildBody: ({ contractId, signer }) => ({
      contractId,
      releaseSigner: signer,
    }),
  },
  {
    key: 'dispute',
    label: 'Open dispute',
    kinds: ['single-release-v2'],
    states: ['active'],
    tone: 'destructive',
    inputs: [
      {
        kind: 'text',
        name: 'reason',
        label: 'Dispute reason',
        placeholder: 'Why are you opening a dispute?',
        maxLength: 500,
      },
    ],
    path: () => '/escrow/single-release/v2/dispute',
    isReady: (v) => typeof v.reason === 'string' && v.reason.trim().length > 0,
    buildBody: ({ contractId, signer, values }) => ({
      contractId,
      signer,
      reason: (values.reason as string).trim(),
    }),
  },
  {
    key: 'resolve-dispute',
    label: 'Resolve dispute',
    kinds: ['single-release-v2'],
    states: ['disputed'],
    requiredRole: 'dispute_resolver',
    tone: 'default',
    inputs: [
      {
        kind: 'distributions',
        name: 'distributions',
        label: 'Distribution — the sum must equal the escrow balance',
      },
    ],
    path: () => '/escrow/single-release/v2/resolve-dispute',
    isReady: (v) =>
      Array.isArray(v.distributions) &&
      v.distributions.length > 0 &&
      v.distributions.every(
        (d) => d.address.trim().length > 0 && Number(d.amount) >= 0,
      ),
    buildBody: ({ contractId, signer, values }) => ({
      contractId,
      disputeResolver: signer,
      distributions: (values.distributions as DistributionRow[]).map((d) => ({
        address: d.address.trim(),
        amount: Number(d.amount),
      })),
    }),
  },
];

const REGISTRY: EscrowActionDef[] = [...SINGLE_RELEASE_V2];

/** Actions defined for a kind. (v1 kinds return none for now — frozen.) */
export function actionsForKind(kind: EscrowKind): EscrowActionDef[] {
  return REGISTRY.filter((a) => a.kinds.includes(kind));
}

/** Narrows a kind's actions to the ones offered in the current state. */
export function actionsForState(
  actions: EscrowActionDef[],
  status: EscrowStatus | null,
): EscrowActionDef[] {
  if (!status) return actions;
  return actions.filter((a) => !a.states || a.states.includes(status));
}
