import 'server-only';

import { cookies } from 'next/headers';

import { serverEnv } from '@/server/env';

/** Fallback cookie lifetime; matches the core's default session TTL (24h). */
const DEFAULT_MAX_AGE = 60 * 60 * 24;

/**
 * The user's SESSION TOKEN — a short-lived JWT the core issues on wallet login
 * (SEP-10) — lives in an httpOnly, secure, sameSite cookie set by the session
 * route handler. Browser JS can never read it (immune to XSS theft). Every
 * authenticated BFF call reads it here and forwards it to the core as
 * `Authorization: Bearer <token>`.
 *
 * The token is opaque to the browser and already signed by the core, so the BFF
 * just stores and forwards it — it never mints or inspects credentials.
 */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  return store.get(serverEnv.SESSION_COOKIE_NAME)?.value ?? null;
}

/**
 * Stores the session token. Aligns the cookie lifetime with the token's own
 * expiry when known, so the cookie can't outlive the JWT it carries.
 */
export async function setSessionToken(
  token: string,
  expiresAt?: string,
): Promise<void> {
  const store = await cookies();
  store.set(serverEnv.SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: maxAgeFrom(expiresAt),
  });
}

export async function clearSession(): Promise<void> {
  const store = await cookies();
  store.delete(serverEnv.SESSION_COOKIE_NAME);
}

function maxAgeFrom(expiresAt?: string): number {
  if (!expiresAt) return DEFAULT_MAX_AGE;
  const seconds = Math.floor(
    (new Date(expiresAt).getTime() - Date.now()) / 1000,
  );
  return seconds > 0 ? seconds : DEFAULT_MAX_AGE;
}
