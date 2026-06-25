'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { Shell } from '@/components/shell';
import { fmtDate } from '@/lib/format';
import { useCreatePlatform, useMyPlatforms } from '@/lib/platforms';
import { useHasMounted } from '@/lib/use-has-mounted';
import { useSession } from '@/lib/session';

export default function PlatformsPage() {
  const mounted = useHasMounted();
  const session = useSession();

  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight">Platforms</h1>
      <p className="mt-1 text-sm text-neutral-500">
        A platform is your tenant — it owns API keys and the subjects (end-users)
        you serve. Your escrows are segmented by platform and subject.
      </p>

      {!mounted ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : !session.data?.authenticated && !session.isLoading ? (
        <SignIn />
      ) : (
        <div className="mt-6">
          <PlatformsSection />
        </div>
      )}
    </Shell>
  );
}

function PlatformsSection() {
  const platforms = useMyPlatforms();
  const create = useCreatePlatform();
  const [name, setName] = useState('');

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">New platform name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Grant Fox"
            className="w-64 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={() => create.mutate(name, { onSuccess: () => setName('') })}
          disabled={create.isPending || name.trim().length === 0}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {create.isPending ? 'Creating…' : 'Create platform'}
        </button>
      </div>

      {create.error && <ErrorLine error={create.error} />}

      {platforms.isLoading && (
        <p className="text-sm text-neutral-500">Loading…</p>
      )}
      {platforms.data && platforms.data.length === 0 && (
        <Empty>No platforms yet. Create one to start.</Empty>
      )}
      {platforms.data && platforms.data.length > 0 && (
        <ul className="divide-y divide-neutral-100">
          {platforms.data.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-neutral-800">
                  {p.name}
                </p>
                <p className="text-xs text-neutral-400">
                  <span className="font-mono">#{p.id}</span> · created{' '}
                  {fmtDate(p.createdAt)}
                </p>
              </div>
              <Link
                href={`/platforms/${p.id}`}
                className="shrink-0 rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-50"
              >
                Subjects →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function SignIn() {
  return (
    <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-10 text-center">
      <p className="text-sm text-neutral-600">
        Sign in to manage your platforms.
      </p>
      <Link
        href="/login"
        className="mt-3 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
      >
        Sign in
      </Link>
    </div>
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
