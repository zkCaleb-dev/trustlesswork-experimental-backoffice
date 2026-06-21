'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { truncateMiddle } from '@/lib/format';
import { publicEnv } from '@/lib/public-env';
import { useLogout, useSession } from '@/lib/session';

/** App chrome for the signed-in area: a top nav bar + a centered container. */
export function Shell({ children }: { children: ReactNode }) {
  const session = useSession();
  const logout = useLogout();
  const pathname = usePathname();
  const authed = session.data?.authenticated ?? false;
  const wallet = session.data?.wallet;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900">
      <nav className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-sm font-semibold tracking-tight">
              Trustless Work
            </Link>
            <NavLink
              href="/escrows"
              active={
                pathname === '/escrows' ||
                (pathname.startsWith('/escrows/') && pathname !== '/escrows/new')
              }
            >
              Escrows
            </NavLink>
            <NavLink href="/escrows/new" active={pathname === '/escrows/new'}>
              New escrow
            </NavLink>
            <NavLink href="/settings" active={pathname === '/settings'}>
              Settings
            </NavLink>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-xs text-neutral-400 sm:inline">
              {publicEnv.stellarNetwork}
            </span>
            {authed ? (
              <>
                {wallet && (
                  <code
                    className="rounded bg-neutral-100 px-2 py-1 text-xs"
                    title={wallet}
                  >
                    {truncateMiddle(wallet)}
                  </code>
                )}
                <button
                  onClick={() => logout.mutate()}
                  disabled={logout.isPending}
                  className="rounded-md border border-neutral-300 px-2.5 py-1 text-xs hover:bg-neutral-100 disabled:opacity-50"
                >
                  Sign out
                </button>
              </>
            ) : (
              <Link
                href="/login"
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-neutral-800"
              >
                Sign in
              </Link>
            )}
          </div>
        </div>
      </nav>
      <div className="mx-auto max-w-4xl px-6 py-8">{children}</div>
    </div>
  );
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`text-sm transition ${
        active
          ? 'font-medium text-neutral-900'
          : 'text-neutral-500 hover:text-neutral-800'
      }`}
    >
      {children}
    </Link>
  );
}
