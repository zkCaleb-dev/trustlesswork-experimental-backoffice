import { z } from 'zod';

import { coreFetch } from '@/server/core/client';
import { parseBody, relay } from '@/server/bff';

const schema = z.object({
  address: z.string().min(1),
  signedXdr: z.string().min(1),
});

/**
 * Recover access: prove a registered wallet (SEP-10) → the core mints a fresh
 * API key, returned ONCE. Like register, this does NOT establish a session; the
 * login page signs the user in via the wallet-session flow afterward.
 */
export async function POST(req: Request) {
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;

  const result = await coreFetch('/auth/recover/verify', {
    method: 'POST',
    body: body.data,
  });
  return relay(result);
}
