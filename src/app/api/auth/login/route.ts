import { NextResponse } from 'next/server';
import { z } from 'zod';

import { coreFetch } from '@/server/core/client';
import { setSessionApiKey } from '@/server/core/session';
import { parseBody } from '@/server/bff';

const schema = z.object({ apiKey: z.string().min(1, 'apiKey is required') });

/**
 * "Sign in with an existing key": validate the pasted key by calling the core's
 * `/users/me` with it, and if it's valid, store it in the httpOnly session
 * cookie. The key is never echoed back to the browser.
 */
export async function POST(req: Request) {
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;

  const me = await coreFetch('/users/me', { apiKey: body.data.apiKey });
  if (!me.ok) {
    return NextResponse.json(
      { code: 'INVALID_API_KEY', detail: 'That API key is not valid.' },
      { status: 401 },
    );
  }

  await setSessionApiKey(body.data.apiKey);
  return NextResponse.json({ authenticated: true, user: me.data });
}
