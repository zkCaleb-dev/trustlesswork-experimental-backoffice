import { NextResponse } from 'next/server';

import { coreFetch } from '@/server/core/client';
import { clearSession, getSessionToken } from '@/server/core/session';

interface CoreWallet {
  address: string;
  verified: boolean;
}

/**
 * Current auth state. Resolves the user from the httpOnly session cookie by
 * asking the core `/users/me` with the session token (as Bearer); if the token
 * is gone or expired, clears the cookie. Also resolves the account's primary
 * wallet so the UI can show "signed in with wallet <address>" instead of a
 * numeric user id.
 */
export async function GET() {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ authenticated: false });
  }

  const me = await coreFetch('/users/me', { bearer: token });
  if (!me.ok) {
    await clearSession();
    return NextResponse.json({ authenticated: false });
  }

  const wallets = await coreFetch<CoreWallet[]>('/users/me/wallets', {
    bearer: token,
  });
  const wallet = wallets.ok ? primaryWallet(wallets.data) : null;

  return NextResponse.json({ authenticated: true, user: me.data, wallet });
}

/** The account's primary wallet: first verified, else first linked, else null. */
function primaryWallet(wallets: CoreWallet[] | null): string | null {
  if (!wallets || wallets.length === 0) return null;
  const verified = wallets.find((w) => w.verified);
  return verified?.address ?? wallets[0]?.address ?? null;
}
