import 'server-only';

import { cookies } from 'next/headers';

import { serverEnv } from '@/server/env';

/**
 * The user's API key lives in an httpOnly, secure, sameSite cookie set by the
 * login/register route handlers — browser JS can never read it (immune to XSS
 * key theft). Every authenticated BFF call reads it here and forwards it to the
 * core as `x-api-key`.
 *
 * F1 TODO: wrap the key in a signed/encrypted payload (using SESSION_SECRET)
 * before mainnet, so a leaked cookie store isn't a plaintext key.
 */
export async function getSessionApiKey(): Promise<string | null> {
  const store = await cookies();
  return store.get(serverEnv.SESSION_COOKIE_NAME)?.value ?? null;
}

export async function setSessionApiKey(apiKey: string): Promise<void> {
  const store = await cookies();
  store.set(serverEnv.SESSION_COOKIE_NAME, apiKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(serverEnv.SESSION_COOKIE_NAME);
}
