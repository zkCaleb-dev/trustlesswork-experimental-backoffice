import { NextResponse } from 'next/server';

import { coreFetch } from '@/server/core/client';
import { clearSession, getSessionToken } from '@/server/core/session';

/**
 * Current auth state. Resolves the user from the httpOnly session cookie by
 * asking the core `/users/me` with the session token (as Bearer); if the token
 * is gone or expired, clears the cookie.
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

  return NextResponse.json({ authenticated: true, user: me.data });
}
