import { NextResponse } from 'next/server';
import { z } from 'zod';

import { platformFetch } from '@/server/core/client';
import { setSessionToken } from '@/server/core/session';
import { parseBody } from '@/server/bff';

const schema = z.object({
  address: z.string().min(1),
  signedXdr: z.string().min(1),
});

/**
 * Step 2 of wallet login: submit the signed challenge. On success the core
 * returns a short-lived session token, which we store in the httpOnly cookie.
 * The token is NEVER returned to the browser — only `{ authenticated: true }`.
 */
export async function POST(req: Request) {
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;

  const result = await platformFetch<{ token: string; expiresAt: string }>(
    '/auth/session/verify',
    { method: 'POST', body: body.data },
  );

  if (!result.ok || !result.data?.token) {
    return NextResponse.json(result.problem, { status: result.status });
  }

  await setSessionToken(result.data.token, result.data.expiresAt);
  return NextResponse.json({ authenticated: true });
}
