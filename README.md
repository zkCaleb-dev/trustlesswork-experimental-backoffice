# Trustless Work — v2 Backoffice (experimental)

A **clean backoffice** for Trustless Work v2 that talks **only to the deployed core**
(no backend of its own, no database). It runs as a single **Next.js app on Vercel**
where Next's server side acts as a thin **BFF (backend-for-frontend)**:

- The **browser holds zero credentials.** Every call to the core goes through
  `/api/*` route handlers that attach the credential server-side.
- The **`BACKOFFICE_ADMIN` key** lives only in a server env var (`BACKOFFICE_ADMIN_API_KEY`),
  never shipped to the browser.
- The **user's API key** lives in an **httpOnly cookie** (immune to XSS theft).

Target core: `https://trustless-core-production.up.railway.app`

## Requirements

- Node.js ≥ 20
- npm

## Setup

```bash
npm install
cp .env.example .env.local   # already provided; edit if needed
npm run dev                  # http://localhost:3000
```

The home page shows the **BFF → core** connection status. If it says
`Core: ok`, the proxy works end-to-end.

### Environment

| Var | Where | Notes |
|-----|-------|-------|
| `CORE_API_URL` | server | The deployed core. |
| `BACKOFFICE_ADMIN_API_KEY` | server | `BACKOFFICE_ADMIN` key for the admin panel. Empty = admin disabled. **Never** `NEXT_PUBLIC`. |
| `SESSION_SECRET` | server | ≥32 bytes; signs the session cookie. `openssl rand -hex 32`. |
| `NEXT_PUBLIC_STELLAR_NETWORK` | public | `testnet` \| `mainnet`. |

On **Vercel**, set the server vars in Project Settings → Environment Variables
(not `NEXT_PUBLIC_`). They stay on the server.

## Architecture

```
Browser ──fetch /api/*──► Next BFF (route handlers, server)
   (no creds)                  │  attaches x-api-key
                               │   • admin key  → from server env
                               │   • user key   → from httpOnly cookie
                               ▼
                     Deployed core (Railway)
```

- `src/server/core/client.ts` — the ONLY place that talks to the core (server-only).
- `src/server/core/session.ts` — httpOnly cookie session (user key).
- `src/app/api/*` — BFF route handlers.
- `src/app/*` — UI (client components → BFF via TanStack Query).

## Security

- Pinned to a **patched Next.js** (≥ 16.2.x) — 2025/26 had several Next CVEs
  (RSC RCE, middleware bypass, DoS); keep it updated and rely on Vercel's
  platform mitigations.
- Security headers + a baseline CSP in `next.config.ts` (tighten to nonces
  before mainnet).
- No secrets in the client bundle (`server-only` guards the server modules).

## Heads-up: redeploy the core for self-registration

The currently deployed core (Railway, ~1 week old) does **not** yet expose the
self-service endpoints (`/auth/register/*`, `/auth/recover/*`, `/users/me/*`).
Those flows are built in the frontend but will only work once the **updated core
(B2–B6) is deployed**. Admin provisioning, escrows and the read-model work today.

## Status

- **F0 (done):** scaffold + BFF + core client + secure headers + health proof.
- Next: F1 auth/onboarding · F2 escrow read · F3 escrow create/actions · F4 admin panel.
