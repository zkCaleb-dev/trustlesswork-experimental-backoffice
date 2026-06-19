import { z } from 'zod';

import { coreFetch } from '@/server/core/client';
import { parseBody, relay } from '@/server/bff';

const schema = z.object({
  address: z.string().min(1),
  signedXdr: z.string().min(1),
  email: z.string().email().optional(),
});

/**
 * Provision a new account: prove wallet ownership (SEP-10) → the core creates
 * the account + first API key, returned ONCE. This does NOT establish a
 * backoffice session — the browser session is always the wallet-login token
 * (see /auth/session/*); the login page signs the user in right after.
 */
export async function POST(req: Request) {
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;

  const result = await coreFetch('/auth/register/verify', {
    method: 'POST',
    body: body.data,
  });
  return relay(result);
}
