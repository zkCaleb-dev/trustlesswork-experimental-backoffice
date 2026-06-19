'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { bffPost } from '@/lib/api';
import { useSession } from '@/lib/session';
import { connectWallet, signXdr } from '@/lib/wallet/kit';

interface Challenge {
  xdr: string;
  networkPassphrase: string;
  expiresAt: string;
}

interface IssuedKey {
  apiKey: string;
  id: string;
  userId: string;
  roles: string[];
  expiresAt: string | null;
  warning: string;
}

/**
 * Wallet login (SEP-10): connect → challenge → sign → verify. The core returns
 * a session token that the BFF stores in an httpOnly cookie; nothing sensitive
 * reaches the browser. `address` is optional so a caller that already connected
 * (e.g. right after register) can reuse it without a second wallet picker.
 */
async function establishSession(address?: string): Promise<void> {
  const addr = address ?? (await connectWallet());
  const challenge = await bffPost<Challenge>('/auth/session/challenge', {
    address: addr,
  });
  const signedXdr = await signXdr(
    challenge.xdr,
    addr,
    challenge.networkPassphrase,
  );
  await bffPost('/auth/session/verify', { address: addr, signedXdr });
}

/** Register/recover: connect → challenge → sign → verify → returns the key + address. */
async function provision(
  kind: 'register' | 'recover',
): Promise<{ issued: IssuedKey; address: string }> {
  const address = await connectWallet();
  const challenge = await bffPost<Challenge>(`/auth/${kind}/challenge`, {
    address,
  });
  const signedXdr = await signXdr(
    challenge.xdr,
    address,
    challenge.networkPassphrase,
  );
  const issued = await bffPost<IssuedKey>(`/auth/${kind}/verify`, {
    address,
    signedXdr,
  });
  return { issued, address };
}

export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const session = useSession();
  const [provisioned, setProvisioned] = useState<{
    issued: IssuedKey;
    address: string;
  } | null>(null);

  const finish = async () => {
    await qc.invalidateQueries({ queryKey: ['session'] });
    router.push('/');
  };

  // Primary: existing users sign in with their wallet (one signature).
  const login = useMutation({
    mutationFn: () => establishSession(),
    onSuccess: finish,
  });

  const register = useMutation({
    mutationFn: () => provision('register'),
    onSuccess: setProvisioned,
  });
  const recover = useMutation({
    mutationFn: () => provision('recover'),
    onSuccess: setProvisioned,
  });

  // After the register/recover key is shown, sign in with the same wallet.
  const enter = useMutation({
    mutationFn: (address: string) => establishSession(address),
    onSuccess: finish,
  });

  if (provisioned) {
    return (
      <ShowKeyOnce
        issued={provisioned.issued}
        busy={enter.isPending}
        error={enter.error}
        onContinue={() => enter.mutate(provisioned.address)}
      />
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-8">
      <header>
        <h1 className="text-2xl font-semibold">Trustless Work Backoffice</h1>
        <p className="text-sm text-neutral-500">
          Sign in with your Stellar wallet.
        </p>
      </header>

      {session.data?.authenticated && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
          You&apos;re already signed in.{' '}
          <Link href="/" className="font-medium underline">
            Go to dashboard
          </Link>
        </p>
      )}

      <Card
        title="Sign in"
        desc="Prove ownership of your wallet (SEP-10). No passwords, no keys to paste."
      >
        <Button
          variant="primary"
          loading={login.isPending}
          onClick={() => login.mutate()}
        >
          Connect wallet &amp; sign in
        </Button>
        {login.error && <ErrorText error={login.error} />}
      </Card>

      <Card
        title="New here? Create an account"
        desc="Register your wallet and get an API key for programmatic access."
      >
        <Button
          variant="secondary"
          loading={register.isPending}
          onClick={() => register.mutate()}
        >
          Connect wallet &amp; register
        </Button>
        {register.error && <ErrorText error={register.error} />}
      </Card>

      <details className="text-sm text-neutral-500">
        <summary className="cursor-pointer select-none">
          Lost your API key?
        </summary>
        <div className="mt-3 rounded-lg border border-neutral-200 bg-white p-5">
          <p className="mb-3 text-xs text-neutral-500">
            Re-prove your registered wallet to mint a fresh key.
          </p>
          <Button
            variant="secondary"
            loading={recover.isPending}
            onClick={() => recover.mutate()}
          >
            Connect wallet &amp; recover
          </Button>
          {recover.error && <ErrorText error={recover.error} />}
        </div>
      </details>
    </main>
  );
}

function ShowKeyOnce({
  issued,
  busy,
  error,
  onContinue,
}: {
  issued: IssuedKey;
  busy: boolean;
  error: Error | null;
  onContinue: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(issued.apiKey);
    setCopied(true);
  };

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 p-8">
      <h1 className="text-xl font-semibold">Save your API key</h1>
      <p className="text-sm text-red-600">{issued.warning}</p>
      <code className="block break-all rounded-md border border-neutral-300 bg-neutral-50 p-3 text-xs">
        {issued.apiKey}
      </code>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy'}
        </Button>
        <Button variant="primary" loading={busy} onClick={onContinue}>
          I saved it — sign in
        </Button>
      </div>
      {error && <ErrorText error={error} />}
      <p className="text-xs text-neutral-400">
        This key is for using the API elsewhere; it won&apos;t be shown again.
        Continuing signs you into the backoffice with your wallet.
      </p>
    </main>
  );
}

function Card({
  title,
  desc,
  children,
}: {
  title: string;
  desc: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white p-5">
      <h2 className="text-sm font-medium text-neutral-800">{title}</h2>
      <p className="mb-3 text-xs text-neutral-500">{desc}</p>
      {children}
    </section>
  );
}

function Button({
  children,
  onClick,
  loading,
  variant,
  type = 'button',
}: {
  children: ReactNode;
  onClick?: () => void;
  loading?: boolean;
  variant: 'primary' | 'secondary';
  type?: 'button' | 'submit';
}) {
  const styles =
    variant === 'primary'
      ? 'bg-neutral-900 text-white hover:bg-neutral-800'
      : 'border border-neutral-300 text-neutral-800 hover:bg-neutral-50';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={loading}
      className={`w-full rounded-md px-3 py-2 text-sm font-medium disabled:opacity-50 ${styles}`}
    >
      {loading ? 'Working…' : children}
    </button>
  );
}

function ErrorText({ error }: { error: unknown }) {
  return (
    <p className="mt-2 text-xs text-red-600">
      {error instanceof Error ? error.message : 'Something went wrong.'}
    </p>
  );
}
