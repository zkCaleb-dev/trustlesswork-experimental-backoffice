'use client';

import Link from 'next/link';
import { useState, type ReactNode } from 'react';

import { Shell } from '@/components/shell';
import {
  ALL_ROLES,
  useCreateUser,
  useDeactivateUser,
  useSetUserRoles,
  useUsers,
  type AdminUser,
} from '@/lib/admin';
import { fmtDate } from '@/lib/format';
import { isAdminSession, useSession } from '@/lib/session';
import { useHasMounted } from '@/lib/use-has-mounted';

export default function AdminPage() {
  const mounted = useHasMounted();
  const session = useSession();
  const admin = isAdminSession(session.data);

  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Operator tools: manage accounts and their roles. A user&apos;s
        wallet-session reflects their roles on the next sign-in.
      </p>

      {!mounted || session.isLoading ? (
        <p className="mt-6 text-sm text-neutral-500">Loading…</p>
      ) : !session.data?.authenticated ? (
        <NotAllowed signIn />
      ) : !admin ? (
        <NotAllowed />
      ) : (
        <div className="mt-6 flex flex-col gap-6">
          <CreateUserSection />
          <UsersSection />
        </div>
      )}
    </Shell>
  );
}

function CreateUserSection() {
  const create = useCreateUser();
  const [email, setEmail] = useState('');

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-medium text-neutral-700">
        Create account
      </h2>
      <div className="flex flex-wrap items-end gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-neutral-400">Email (optional)</span>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
            inputMode="email"
            className="w-64 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </label>
        <button
          onClick={() => create.mutate(email, { onSuccess: () => setEmail('') })}
          disabled={create.isPending}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
        >
          {create.isPending ? 'Creating…' : 'Create account'}
        </button>
      </div>
      {create.error && <ErrorLine error={create.error} />}
    </section>
  );
}

function UsersSection() {
  const users = useUsers();

  return (
    <section className="rounded-xl border border-neutral-200 bg-white p-5">
      <h2 className="mb-3 text-sm font-medium text-neutral-700">Accounts</h2>
      {users.isLoading && <p className="text-sm text-neutral-500">Loading…</p>}
      {users.error && <ErrorLine error={users.error} />}
      {users.data && users.data.length === 0 && <Empty>No users.</Empty>}
      {users.data && users.data.length > 0 && (
        <ul className="divide-y divide-neutral-100">
          {users.data.map((u) => (
            <UserRow key={u.id} user={u} />
          ))}
        </ul>
      )}
    </section>
  );
}

function UserRow({ user }: { user: AdminUser }) {
  const rolesMut = useSetUserRoles();
  const deactivate = useDeactivateUser();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(user.roles);

  const toggle = (r: string) =>
    setDraft((d) => (d.includes(r) ? d.filter((x) => x !== r) : [...d, r]));

  return (
    <li className="py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm text-neutral-800">
            {user.email ?? '(no email)'}
            {!user.isActive && (
              <span className="ml-1 text-xs text-red-500">· inactive</span>
            )}
          </p>
          <p className="text-xs text-neutral-400">
            <span className="font-mono">#{user.id}</span> ·{' '}
            {user.roles.join(', ') || 'no roles'} · {fmtDate(user.createdAt)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => {
              setDraft(user.roles);
              setEditing((e) => !e);
            }}
            className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-50"
          >
            {editing ? 'Cancel' : 'Edit roles'}
          </button>
          {user.isActive && (
            <button
              onClick={() => deactivate.mutate(user.id)}
              disabled={deactivate.isPending}
              className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              Deactivate
            </button>
          )}
        </div>
      </div>

      {editing && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-md bg-neutral-50 p-3">
          {ALL_ROLES.map((r) => (
            <label key={r} className="flex items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={draft.includes(r)}
                onChange={() => toggle(r)}
              />
              {r}
            </label>
          ))}
          <button
            onClick={() =>
              rolesMut.mutate(
                { userId: user.id, roles: draft },
                { onSuccess: () => setEditing(false) },
              )
            }
            disabled={rolesMut.isPending || draft.length === 0}
            className="rounded-md bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white hover:bg-neutral-800 disabled:opacity-50"
          >
            {rolesMut.isPending ? 'Saving…' : 'Save roles'}
          </button>
          {rolesMut.error && (
            <span className="text-xs text-red-600">
              {rolesMut.error instanceof Error
                ? rolesMut.error.message
                : 'Error'}
            </span>
          )}
        </div>
      )}
    </li>
  );
}

function NotAllowed({ signIn }: { signIn?: boolean }) {
  return (
    <div className="mt-6 rounded-xl border border-neutral-200 bg-white p-10 text-center">
      <p className="text-sm text-neutral-600">
        {signIn
          ? 'Sign in to continue.'
          : 'You need an admin role to view this page.'}
      </p>
      {signIn && (
        <Link
          href="/login"
          className="mt-3 inline-block rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-800"
        >
          Sign in
        </Link>
      )}
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
