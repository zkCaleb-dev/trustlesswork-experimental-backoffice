import 'server-only';

import { z } from 'zod';

/**
 * Server-only environment. The `server-only` import makes the build FAIL if this
 * module is ever imported into a client component — so the core URL, the admin
 * key and the session secret can never leak into the browser bundle.
 */
const schema = z.object({
  CORE_API_URL: z.string().min(1, 'CORE_API_URL is required'),
  BACKOFFICE_ADMIN_API_KEY: z.string().optional().default(''),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 chars'),
  SESSION_COOKIE_NAME: z.string().default('tw_session'),
});

const parsed = schema.safeParse({
  CORE_API_URL: process.env.CORE_API_URL,
  BACKOFFICE_ADMIN_API_KEY: process.env.BACKOFFICE_ADMIN_API_KEY,
  SESSION_SECRET: process.env.SESSION_SECRET,
  SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME,
});

if (!parsed.success) {
  const details = parsed.error.issues
    .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Invalid server environment:\n${details}`);
}

export const serverEnv = parsed.data;

/** The admin panel is enabled only when a server-only admin key is configured. */
export const isAdminEnabled = serverEnv.BACKOFFICE_ADMIN_API_KEY.length > 0;
