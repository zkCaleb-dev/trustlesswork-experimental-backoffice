import { NextResponse } from 'next/server';

import { coreFetch } from '@/server/core/client';
import { clearSession, getSessionApiKey } from '@/server/core/session';

/**
 * Current auth state. Resolves the user from the httpOnly session cookie by
 * asking the core `/users/me`; if the key is gone/invalid, clears the cookie.
 */
export async function GET() {
  const apiKey = await getSessionApiKey();
  if (!apiKey) {
    return NextResponse.json({ authenticated: false });
  }

  const me = await coreFetch('/users/me', { apiKey });
  if (!me.ok) {
    await clearSession();
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({ authenticated: true, user: me.data });
}
