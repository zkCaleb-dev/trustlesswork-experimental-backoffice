import { z } from 'zod';

import { coreFetch } from '@/server/core/client';
import { parseBody, relay } from '@/server/bff';

const schema = z.object({ address: z.string().min(1, 'address is required') });

export async function POST(req: Request) {
  const body = await parseBody(req, schema);
  if (!body.ok) return body.response;

  const result = await coreFetch('/auth/register/challenge', {
    method: 'POST',
    body: { address: body.data.address },
  });
  return relay(result);
}
