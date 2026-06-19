import { z } from 'zod';

import { coreFetch } from '@/server/core/client';
import { setSessionApiKey } from '@/server/core/session';
import { parseBody, relay } from '@/server/bff';

const schema = z.object({
  address: z.string().min(1),
  signedXdr: z.string().min(1),
  email: z.string().email().optional(),
});

export async function POST(req: Request) {
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;

  const result = await coreFetch<{ apiKey?: string }>('/auth/register/verify', {
    method: 'POST',
    body: body.data,
  });

  // On success, log the new account in via the httpOnly cookie. The plaintext
  // key is still returned ONCE so the UI can let the user save it.
  if (result.ok && result.data?.apiKey) {
    await setSessionApiKey(result.data.apiKey);
  }
  return relay(result);
}
