import 'server-only';

import * as crypto from 'node:crypto';

import { cookies } from 'next/headers';

import { serverEnv } from '@/server/env';

/** Fallback cookie lifetime; matches the core's default session TTL (2h). */
const DEFAULT_MAX_AGE = 60 * 60 * 2;

/** AES-256 key derived from SESSION_SECRET (any length → 32 bytes). */
const KEY = crypto.createHash('sha256').update(serverEnv.SESSION_SECRET).digest();

/**
 * The user's SESSION TOKEN — the core-issued wallet-session JWT — lives in an
 * httpOnly, secure, sameSite cookie. We additionally **encrypt** the value with
 * `SESSION_SECRET` (AES-256-GCM) so the browser cookie is opaque ciphertext: a
 * leaked cookie string can only be used through THIS BFF (which holds the key),
 * never replayed directly against the core. The BFF decrypts server-side and
 * forwards the inner JWT as `Authorization: Bearer`.
 */
export async function getSessionToken(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(serverEnv.SESSION_COOKIE_NAME)?.value;
  return raw ? decrypt(raw) : null;
}

/**
 * Stores the (encrypted) session token. Aligns the cookie lifetime with the
 * token's own expiry when known, so the cookie can't outlive the JWT.
 */
export async function setSessionToken(
  token: string,
  expiresAt?: string,
): Promise<void> {
  const store = await cookies();
  store.set(serverEnv.SESSION_COOKIE_NAME, encrypt(token), {
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

/** AES-256-GCM: iv(12) ‖ tag(16) ‖ ciphertext, base64url. */
function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64url');
}

/** Returns null on any failure (tampered / old plaintext cookie) → re-login. */
function decrypt(payload: string): string | null {
  try {
    const buf = Buffer.from(payload, 'base64url');
    if (buf.length < 28) return null;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
      'utf8',
    );
  } catch {
    return null;
  }
}
