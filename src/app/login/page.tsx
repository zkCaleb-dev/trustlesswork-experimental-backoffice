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

/** Shared wallet flow for register + recover: connect → challenge → sign → verify. */
async function runWalletAuth(kind: 'register' | 'recover'): Promise<IssuedKey> {
  const address = await connectWallet();
  const challenge = await bffPost<Challenge>(`/auth/${kind}/challenge`, { address });
  const signedXdr = await signXdr(
    challenge.xdr,
    address,
    challenge.networkPassphrase,
  );
  return bffPost<IssuedKey>(`/auth/${kind}/verify`, { address, signedXdr });
}

export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const session = useSession();
  const [issuedKey, setIssuedKey] = useState<IssuedKey | null>(null);

  const finish = async () => {
    await qc.invalidateQueries({ queryKey: ['session'] });
    router.push('/');
  };

  const register = useMutation({
    mutationFn: () => runWalletAuth('register'),
    onSuccess: setIssuedKey,
  });
  const recover = useMutation({
    mutationFn: () => runWalletAuth('recover'),
    onSuccess: setIssuedKey,
  });
  const login = useMutation({
    mutationFn: (apiKey: string) => bffPost('/auth/login', { apiKey }),
    onSuccess: finish,
  });

  if (issuedKey) {
    return <ShowKeyOnce issued={issuedKey} onContinue={finish} />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 p-8">
      <header>
        <h1 className="text-2xl font-semibold">Trustless Work Backoffice</h1>
        <p className="text-sm text-neutral-500">Sign in or create an account.</p>
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
        title="New here? Register with your wallet"
        desc="Prove ownership of your Stellar wallet (SEP-10) and get your API key."
      >
        <Button
          variant="primary"
          loading={register.isPending}
          onClick={() => register.mutate()}
        >
          Connect wallet &amp; register
        </Button>
        {register.error && <ErrorText error={register.error} />}
      </Card>

      <Card
        title="Lost your key? Recover access"
        desc="Re-prove your registered wallet to mint a fresh key."
      >
        <Button
          variant="secondary"
          loading={recover.isPending}
          onClick={() => recover.mutate()}
        >
          Connect wallet &amp; recover
        </Button>
        {recover.error && <ErrorText error={recover.error} />}
      </Card>

      <Card title="Have an API key? Sign in" desc="Paste an existing key to sign in.">
        <KeyForm loading={login.isPending} onSubmit={(k) => login.mutate(k)} />
        {login.error && <ErrorText error={login.error} />}
      </Card>
    </main>
  );
}

function ShowKeyOnce({
  issued,
  onContinue,
}: {
  issued: IssuedKey;
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
        <Button variant="primary" onClick={onContinue}>
          I saved it — continue
        </Button>
      </div>
      <p className="text-xs text-neutral-400">
        You&apos;re already signed in (session cookie). This key is for using the
        API elsewhere; it will never be shown again.
      </p>
    </main>
  );
}

function KeyForm({
  loading,
  onSubmit,
}: {
  loading: boolean;
  onSubmit: (apiKey: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (value.trim()) onSubmit(value.trim());
      }}
    >
      <input
        type="password"
        autoComplete="off"
        placeholder="id.secret"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="rounded-md border border-neutral-300 px-3 py-2 text-sm"
      />
      <Button variant="primary" type="submit" loading={loading}>
        Sign in
      </Button>
    </form>
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
