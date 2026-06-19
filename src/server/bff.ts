import 'server-only';

import { NextResponse } from 'next/server';
import type { z } from 'zod';

import type { CoreResult } from '@/server/core/client';

type ParsedBody<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

/** Parse + validate a JSON body; returns a 400 response on failure. */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodType<T>,
): Promise<ParsedBody<T>> {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          code: 'VALIDATION_ERROR',
          detail: parsed.error.issues.map((i) => i.message).join('; '),
        },
        { status: 400 },
      ),
    };
  }
  return { ok: true, data: parsed.data };
}

/** Forward a core result to the browser as-is (data on success, problem on error). */
export function relay(result: CoreResult<unknown>): NextResponse {
  return NextResponse.json(result.ok ? result.data : result.problem, {
    status: result.status,
  });
}
