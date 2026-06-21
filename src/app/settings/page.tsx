'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { Shell } from '@/components/shell';
import {
  useCreateApiKey,
  useLinkWallet,
  useMyApiKeys,
  useMyWallets,
  useRevokeApiKey,
  useRotateApiKey,
  useUnlinkWallet,
  type ApiKey,
  type GeneratedApiKey,
  type LinkedWallet,
} from '@/lib/account';
import { fmtDate, truncateMiddle } from '@/lib/format';
import { useHasMounted } from '@/lib/use-has-mounted';
import { useSession } from '@/lib/session';

export default function SettingsPage() {
  const mounted = useHasMounted();
  const session = useSession();

  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Your API keys (for programmatic access) and linked wallets.
      </p>

      {!mounted ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : !session.data?.authenticated && !session.isLoading ? (
        <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-10 text-center">
          <p className="text-sm text-neutral-600">Sign in to manage your account.</p>
          <Link
            href="/login"
            className="mt-3 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          <ApiKeysSection />
          <WalletsSection />
        </div>
      )}
    </Shell>
  );
}

function ApiKeysSection() {
  const keys = useMyApiKeys();
  const create = useCreateApiKey();
  const rotate = useRotateApiKey();
  const revoke = useRevokeApiKey();
  const [description, setDescription] = useState('');
  const [generated, setGenerated] = useState<GeneratedApiKey | null>(null);

  const active = (keys.data ?? []).filter((k) => k.active);

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-700">API keys</h2>
        <span className="text-xs text-neutral-400">
          {active.length} active
        </span>
      </div>

      {generated && (
        <ShowKeyOnce
          generated={generated}
          onDismiss={() => setGenerated(null)}
        />
      )}

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">New key description</span>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. mobile app"
            className="w-56 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={() =>
            create.mutate(description, {
              onSuccess: (g) => {
                setGenerated(g);
                setDescription('');
              },
            })
          }
          disabled={create.isPending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {create.isPending ? 'Creating…' : 'Create key'}
        </button>
      </div>

      {(create.error || rotate.error || revoke.error) && (
        <ErrorLine
          error={create.error ?? rotate.error ?? revoke.error}
        />
      )}

      {keys.isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {keys.data && active.length === 0 && (
        <Empty>No active keys. Create one for programmatic API access.</Empty>
      )}
      {active.length > 0 && (
        <ul className="divide-y divide-neutral-100">
          {active.map((k) => (
            <ApiKeyRow
              key={k.id}
              apiKey={k}
              busy={rotate.isPending || revoke.isPending}
              onRotate={() =>
                rotate.mutate(k.id, { onSuccess: (g) => setGenerated(g) })
              }
              onRevoke={() => revoke.mutate(k.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function ApiKeyRow({
  apiKey,
  busy,
  onRotate,
  onRevoke,
}: {
  apiKey: ApiKey;
  busy: boolean;
  onRotate: () => void;
  onRevoke: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-neutral-800">
          {apiKey.description ?? '(no description)'}
        </p>
        <p className="text-xs text-neutral-400">
          <span className="font-mono">{apiKey.id}</span> · created{' '}
          {fmtDate(apiKey.createdAt)}
          {apiKey.lastUsedAt && <> · last used {fmtDate(apiKey.lastUsedAt)}</>}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          onClick={onRotate}
          disabled={busy}
          className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
        >
          Rotate
        </button>
        <button
          onClick={onRevoke}
          disabled={busy}
          className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Revoke
        </button>
      </div>
    </li>
  );
}

function ShowKeyOnce({
  generated,
  onDismiss,
}: {
  generated: GeneratedApiKey;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
      <p className="text-sm font-medium text-amber-900">
        Save this key — it won&apos;t be shown again.
      </p>
      <code className="mt-2 block break-all rounded border border-amber-200 bg-white p-2 text-xs">
        {generated.apiKey}
      </code>
      <div className="mt-2 flex gap-2">
        <button
          onClick={async () => {
            await navigator.clipboard.writeText(generated.apiKey);
            setCopied(true);
          }}
          className="rounded-md border border-amber-300 bg-white px-2.5 py-1 text-xs hover:bg-amber-100"
        >
          {copied ? 'Copied ✓' : 'Copy'}
        </button>
        <button
          onClick={onDismiss}
          className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-800"
        >
          Done
        </button>
      </div>
    </div>
  );
}

function WalletsSection() {
  const wallets = useMyWallets();
  const link = useLinkWallet();
  const unlink = useUnlinkWallet();

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-neutral-700">Wallets</h2>
        <button
          onClick={() => link.mutate()}
          disabled={link.isPending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {link.isPending ? 'Linking…' : 'Link wallet'}
        </button>
      </div>

      <p className="mb-3 text-xs text-neutral-500">
        Verified wallets are what grant you visibility into the escrows they
        participate in.
      </p>

      {(link.error || unlink.error) && (
        <ErrorLine error={link.error ?? unlink.error} />
      )}

      {wallets.isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {wallets.data && wallets.data.length === 0 && (
        <Empty>No wallets linked yet.</Empty>
      )}
      {wallets.data && wallets.data.length > 0 && (
        <ul className="divide-y divide-neutral-100">
          {wallets.data.map((w) => (
            <WalletRow
              key={w.address}
              wallet={w}
              busy={unlink.isPending}
              onUnlink={() => unlink.mutate(w.address)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function WalletRow({
  wallet,
  busy,
  onUnlink,
}: {
  wallet: LinkedWallet;
  busy: boolean;
  onUnlink: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="font-mono text-sm text-neutral-800" title={wallet.address}>
          {truncateMiddle(wallet.address, 8, 6)}
        </p>
        <p className="text-xs text-neutral-400">
          linked {fmtDate(wallet.createdAt)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            wallet.verified
              ? 'bg-green-100 text-green-800'
              : 'bg-neutral-100 text-neutral-500'
          }`}
        >
          {wallet.verified ? 'verified' : 'pending'}
        </span>
        <button
          onClick={onUnlink}
          disabled={busy}
          className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-50 disabled:opacity-50"
        >
          Unlink
        </button>
      </div>
    </li>
  );
}

function ErrorLine({ error }: { error: unknown }) {
  return (
    <p className="mb-3 text-xs text-red-600">
      {error instanceof Error ? error.message : 'Something went wrong.'}
    </p>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-neutral-400">{children}</p>;
}
