/**
 * Declarative registry of on-chain escrow actions.
 *
 * Each action declares which escrow kind it applies to, the lifecycle states
 * it is offered in, the participant role(s) that must sign it, its input
 * fields, and how to build the request body. The ActionsPanel renders this —
 * adding an action is a data change here, not new UI.
 *
 * The read-model exposes contractType as the FLAVOR only (single-release /
 * multi-release), never the version. The version is derived from the snapshot
 * shape: v2 carries role lists (roles.approvers[]), v1 a single roles.approver.
 *
 * single-release-v2 and multi-release-v2 share the same action set; the ONLY
 * difference is that multi-release operates per-milestone, so release, dispute
 * and resolve-dispute additionally take `milestoneIndexes[]` (and dispute is a
 * different endpoint). That invariant lives in `v2Actions()` below.
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

export interface StatusUpdateRow {
  index: string;
  status: string;
  evidence: string;
}

/** Per-action form state (string scalars, or rows for composite inputs). */
export type ActionValues = Record<
  string,
  string | DistributionRow[] | StatusUpdateRow[]
>;

export type ActionInput =
  | { kind: 'amount'; name: string; label: string; placeholder?: string }
  | {
      kind: 'text';
      name: string;
      label: string;
      placeholder?: string;
      maxLength?: number;
    }
  | { kind: 'indexes'; name: string; label: string; placeholder?: string }
  | { kind: 'distributions'; name: string; label: string }
  | { kind: 'statusUpdates'; name: string; label: string };

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
   * Participant role(s) that must sign. ALL listed roles are required (e.g.
   * approve-and-release needs approver AND release_signer). Used to gate by
   * the connected wallet's roles and to tell the user which wallet to use.
   * Omit for actions anyone can call (e.g. fund, open dispute).
   */
  requiredRoles?: ParticipantRole[];
  tone?: 'default' | 'secondary' | 'destructive';
  inputs?: ActionInput[];
  /** Endpoint that builds the unsigned tx, per kind. */
  path: (kind: EscrowKind) => string;
  /** True when the current inputs are enough to submit. */
  isReady?: (values: ActionValues) => boolean;
  /** Assembles the request body sent to the build endpoint. */
  buildBody: (ctx: BuildContext) => Record<string, unknown>;
}

// ── value helpers ───────────────────────────────────────────────────────────

/** Narrows a form value to a row array of the expected shape. */
function rowsOf<T>(value: ActionValues[string] | undefined): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

/** Parses a comma-separated index field into a clean list of u32 indexes. */
function toIndexes(value: ActionValues[string] | undefined): number[] {
  if (typeof value !== 'string') return [];
  return value
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0);
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
    if (input.kind === 'distributions') {
      out[input.name] = [{ address: '', amount: '' }];
    } else if (input.kind === 'statusUpdates') {
      out[input.name] = [{ index: '', status: '', evidence: '' }];
    } else {
      out[input.name] = '';
    }
  }
  return out;
}

// ── shared inputs & body helpers ──────────────────────────────────────────────

const MILESTONE_INDEXES_INPUT: ActionInput = {
  kind: 'indexes',
  name: 'milestoneIndexes',
  label: 'Milestone indexes (comma-separated, 0-based)',
  placeholder: '0, 1',
};

const REASON_INPUT: ActionInput = {
  kind: 'text',
  name: 'reason',
  label: 'Dispute reason',
  placeholder: 'Why are you opening a dispute?',
  maxLength: 500,
};

const distributionsInput = (label: string): ActionInput => ({
  kind: 'distributions',
  name: 'distributions',
  label,
});

const indexesReady = (v: ActionValues): boolean =>
  toIndexes(v.milestoneIndexes).length > 0;

const distributionsReady = (v: ActionValues): boolean => {
  const rows = rowsOf<DistributionRow>(v.distributions);
  return (
    rows.length > 0 &&
    rows.every((d) => d.address.trim() !== '' && Number(d.amount) >= 0)
  );
};

const distributionsBody = (values: ActionValues) =>
  rowsOf<DistributionRow>(values.distributions).map((d) => ({
    address: d.address.trim(),
    amount: Number(d.amount),
  }));

// ── registry ──────────────────────────────────────────────────────────────

/**
 * The v2 action set, parametrized by flavor. Single- and multi-release share
 * everything except: multi-release release/dispute/resolve take milestone
 * indexes, and its dispute endpoint is `dispute-milestones`.
 */
function v2Actions(
  kind: 'single-release-v2' | 'multi-release-v2',
): EscrowActionDef[] {
  const multi = kind === 'multi-release-v2';
  const base = `/escrow/${multi ? 'multi-release' : 'single-release'}/v2`;

  return [
    {
      key: 'fund',
      label: 'Fund',
      kinds: [kind],
      states: ['active'],
      tone: 'default',
      inputs: [
        { kind: 'amount', name: 'amount', label: 'Amount to fund', placeholder: '100' },
      ],
      path: () => `${base}/fund`,
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
      kinds: [kind],
      states: ['active'],
      requiredRoles: ['release_signer'],
      tone: 'secondary',
      inputs: multi ? [MILESTONE_INDEXES_INPUT] : undefined,
      path: () => `${base}/release-funds`,
      isReady: multi ? indexesReady : undefined,
      buildBody: ({ contractId, signer, values }) => ({
        contractId,
        releaseSigner: signer,
        ...(multi ? { milestoneIndexes: toIndexes(values.milestoneIndexes) } : {}),
      }),
    },
    {
      key: 'approve-milestones',
      label: 'Approve milestones',
      kinds: [kind],
      states: ['active'],
      requiredRoles: ['approver'],
      tone: 'default',
      inputs: [MILESTONE_INDEXES_INPUT],
      path: () => `${base}/approve-milestones`,
      isReady: indexesReady,
      buildBody: ({ contractId, signer, values }) => ({
        contractId,
        approver: signer,
        milestoneIndexes: toIndexes(values.milestoneIndexes),
      }),
    },
    {
      key: 'approve-and-release',
      label: 'Approve & release',
      kinds: [kind],
      states: ['active'],
      requiredRoles: ['approver', 'release_signer'],
      tone: 'secondary',
      inputs: [MILESTONE_INDEXES_INPUT],
      path: () => `${base}/approve-and-release-milestones`,
      isReady: indexesReady,
      buildBody: ({ contractId, signer, values }) => ({
        contractId,
        signer,
        milestoneIndexes: toIndexes(values.milestoneIndexes),
      }),
    },
    {
      key: 'change-milestone-status',
      label: 'Update milestone status',
      kinds: [kind],
      states: ['active'],
      requiredRoles: ['service_provider'],
      tone: 'secondary',
      inputs: [
        { kind: 'statusUpdates', name: 'updates', label: 'Milestone status updates' },
      ],
      path: () => `${base}/change-milestone-status`,
      isReady: (v) => {
        const rows = rowsOf<StatusUpdateRow>(v.updates);
        return (
          rows.length > 0 &&
          rows.every((r) => r.index.trim() !== '' && r.status.trim() !== '')
        );
      },
      buildBody: ({ contractId, signer, values }) => ({
        contractId,
        serviceProvider: signer,
        updates: rowsOf<StatusUpdateRow>(values.updates)
          .filter((r) => r.index.trim() !== '')
          .map((r) => ({
            index: Number(r.index),
            newStatus: r.status.trim(),
            ...(r.evidence.trim() ? { newEvidence: r.evidence.trim() } : {}),
          })),
      }),
    },
    {
      key: 'dispute',
      label: multi ? 'Dispute milestones' : 'Open dispute',
      kinds: [kind],
      states: ['active'],
      tone: 'destructive',
      inputs: multi ? [MILESTONE_INDEXES_INPUT, REASON_INPUT] : [REASON_INPUT],
      path: () => `${base}/${multi ? 'dispute-milestones' : 'dispute'}`,
      isReady: (v) =>
        typeof v.reason === 'string' &&
        v.reason.trim().length > 0 &&
        (!multi || indexesReady(v)),
      buildBody: ({ contractId, signer, values }) => ({
        contractId,
        signer,
        ...(multi ? { milestoneIndexes: toIndexes(values.milestoneIndexes) } : {}),
        reason: (values.reason as string).trim(),
      }),
    },
    {
      key: 'resolve-dispute',
      label: 'Resolve dispute',
      kinds: [kind],
      states: ['disputed'],
      requiredRoles: ['dispute_resolver'],
      tone: 'default',
      inputs: multi
        ? [
            MILESTONE_INDEXES_INPUT,
            distributionsInput('Distribution — the sum must equal the disputed balance'),
          ]
        : [distributionsInput('Distribution — the sum must equal the escrow balance')],
      path: () => `${base}/resolve-dispute`,
      isReady: (v) => distributionsReady(v) && (!multi || indexesReady(v)),
      buildBody: ({ contractId, signer, values }) => ({
        contractId,
        disputeResolver: signer,
        ...(multi ? { milestoneIndexes: toIndexes(values.milestoneIndexes) } : {}),
        distributions: distributionsBody(values),
      }),
    },
    {
      key: 'withdraw-remaining',
      label: 'Withdraw remaining',
      kinds: [kind],
      states: ['released', 'disputed'],
      requiredRoles: ['dispute_resolver'],
      tone: 'secondary',
      inputs: [distributionsInput('Distribution of the remaining balance')],
      path: () => `${base}/withdraw-remaining-funds`,
      isReady: distributionsReady,
      buildBody: ({ contractId, signer, values }) => ({
        contractId,
        disputeResolver: signer,
        distributions: distributionsBody(values),
      }),
    },
    {
      key: 'extend-ttl',
      label: 'Extend TTL',
      kinds: [kind],
      states: ['active'],
      requiredRoles: ['admin'],
      tone: 'secondary',
      inputs: [
        { kind: 'amount', name: 'ledgers', label: 'Ledgers to extend', placeholder: '100000' },
      ],
      path: () => `${base}/extend-ttl`,
      isReady: (v) => Number.isInteger(Number(v.ledgers)) && Number(v.ledgers) >= 1,
      buildBody: ({ contractId, signer, values }) => ({
        contractId,
        admin: signer,
        ledgersToExtend: Number(values.ledgers),
      }),
    },
  ];
}

const REGISTRY: EscrowActionDef[] = [
  ...v2Actions('single-release-v2'),
  ...v2Actions('multi-release-v2'),
];

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
