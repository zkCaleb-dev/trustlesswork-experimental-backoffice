import { NextResponse } from 'next/server';

import { coreFetch } from '@/server/core/client';
import { clearSession, getSessionToken } from '@/server/core/session';

/**
 * Logout. Best-effort revokes the session SERVER-SIDE first (the core bumps the
 * account's token epoch, instantly killing every wallet-session JWT — not just
 * this cookie), then clears the local cookie regardless of the core's response.
 * We never block sign-out on the network: a failed/again-expired token still
 * results in a cleared cookie.
 */
export async function POST() {
  const token = await getSessionToken();
  if (token) {
    try {
      await coreFetch('/auth/session/logout', { method: 'POST', bearer: token });
    } catch {
      // Ignore — clearing the cookie below is what the user observes.
    }
  }

  await clearSession();
  return NextResponse.json({ ok: true });
}
