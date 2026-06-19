import { z } from 'zod';

import { coreFetch } from '@/server/core/client';
import { parseBody, relay } from '@/server/bff';

const schema = z.object({ address: z.string().min(1, 'address is required') });

/**
 * Step 1 of wallet login: ask the core for a SEP-10 challenge to sign. Public —
 * no credential required. Rejects wallets that are not registered.
 */
export async function POST(req: Request) {
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;

  const result = await coreFetch('/auth/session/challenge', {
    method: 'POST',
    body: { address: body.data.address },
  });
  return relay(result);
}
