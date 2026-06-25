'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { Shell } from '@/components/shell';
import { fmtDate, truncateMiddle } from '@/lib/format';
import {
  useCreateSubject,
  useMyPlatforms,
  useSubjects,
  type Subject,
} from '@/lib/platforms';
import { useHasMounted } from '@/lib/use-has-mounted';
import { useSession } from '@/lib/session';

export default function PlatformSubjectsPage() {
  const mounted = useHasMounted();
  const session = useSession();
  const { id } = useParams<{ id: string }>();
  const platforms = useMyPlatforms();
  const platform = platforms.data?.find((p) => p.id === id);

  return (
    <Shell>
      <Link
        href="/platforms"
        className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800"
      >
        <ArrowLeft className="size-4" /> Platforms
      </Link>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        {platform ? platform.name : 'Platform'}{' '}
        <span className="font-mono text-base font-normal text-neutral-400">
          #{id}
        </span>
      </h1>
      <p className="mt-1 text-sm text-neutral-500">
        Subjects are this platform&apos;s end-users. Attach one to a deploy via
        the <code>X-TW-Subject</code> header and filter escrows by it.
      </p>

      {!mounted ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : !session.data?.authenticated && !session.isLoading ? (
        <SignIn />
      ) : (
        <div className="mt-6">
          <SubjectsSection platformId={id} />
        </div>
      )}
    </Shell>
  );
}

function SubjectsSection({ platformId }: { platformId: string }) {
  const subjects = useSubjects(platformId);
  const create = useCreateSubject(platformId);
  const [externalId, setExternalId] = useState('');
  const [label, setLabel] = useState('');
  const [walletAddress, setWalletAddress] = useState('');

  const reset = () => {
    setExternalId('');
    setLabel('');
    setWalletAddress('');
  };
  const empty =
    externalId.trim() === '' &&
    label.trim() === '' &&
    walletAddress.trim() === '';

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-medium text-neutral-700">Subjects</h2>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <Field
          label="External id"
          value={externalId}
          onChange={setExternalId}
          placeholder="user_42"
        />
        <Field
          label="Label"
          value={label}
          onChange={setLabel}
          placeholder="Juan Perez"
        />
        <Field
          label="Wallet (optional)"
          value={walletAddress}
          onChange={setWalletAddress}
          placeholder="G…"
          width="w-72"
        />
        <button
          onClick={() =>
            create.mutate(
              { externalId, label, walletAddress },
              { onSuccess: reset },
            )
          }
          disabled={create.isPending || empty}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {create.isPending ? 'Adding…' : 'Add subject'}
        </button>
      </div>

      {create.error && <ErrorLine error={create.error} />}

      {subjects.isLoading && (
        <p className="text-sm text-neutral-500">Loading…</p>
      )}
      {subjects.data && subjects.data.length === 0 && (
        <Empty>No subjects yet.</Empty>
      )}
      {subjects.data && subjects.data.length > 0 && (
        <ul className="divide-y divide-neutral-100">
          {subjects.data.map((s) => (
            <SubjectRow key={s.id} subject={s} />
          ))}
        </ul>
      )}
    </section>
  );
}

function SubjectRow({ subject }: { subject: Subject }) {
  return (
    <li className="flex items-center justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm text-neutral-800">
          {subject.label ?? subject.externalId ?? '(unnamed)'}
        </p>
        <p className="text-xs text-neutral-400">
          <span className="font-mono">#{subject.id}</span>
          {subject.externalId && <> · ext: {subject.externalId}</>}
          {subject.walletAddress && (
            <> · {truncateMiddle(subject.walletAddress, 6, 6)}</>
          )}{' '}
          · {fmtDate(subject.createdAt)}
        </p>
      </div>
    </li>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  width = 'w-44',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  width?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs text-neutral-400">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${width} rounded-md border border-neutral-300 px-2 py-1.5 text-sm`}
      />
    </label>
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
