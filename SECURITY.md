# Security notes

## Credential model (the important part)

This app holds **no credentials in the browser**. It talks to the core only
through server-side BFF route handlers (`/api/*`):

- the `BACKOFFICE_ADMIN` key is a **server-only** env var (admin calls only);
- the human user logs in with their **wallet** (SEP-10). The core returns a
  short-lived **session token** (JWT) that lives in an **httpOnly** cookie and
  is forwarded to the core as `Authorization: Bearer`. The browser never sees it.

A successful XSS therefore cannot read the session token or any API key. API
keys are a separate, opt-in feature (machine / integration credentials) the user
manages from the dashboard — they are never pasted into the browser to log in.

## Dependency audit (`npm audit`)

`npm audit` reports vulnerabilities in the dependency tree of
`@creit.tech/stellar-wallets-kit`. **Every one of them** traces to the kit's
bundled **multi-chain connectors** — WalletConnect / Reown AppKit, EVM
(`viem`, Safe), NEAR, Solana, Trezor — code paths a **Stellar-only** app never
invokes.

Posture:

- **Not reachable.** We instantiate the kit with **Stellar modules only**
  (Freighter, Albedo, xBull, Lobstr, Rabet). The WalletConnect / EVM / NEAR /
  Solana / Trezor connectors are never constructed or called, and the bundler
  tree-shakes most of them out of the client bundle.
- **No impact on credentials.** All sensitive credentials live server-side (see
  above); these advisories are client-side wallet-connector libraries.
- **Maintenance.** Run `npm audit fix` (non-breaking) on updates, keep
  `@creit.tech/stellar-wallets-kit` current, and re-evaluate if it ever ships a
  lighter / Stellar-only build.

## Next.js

Pinned to a patched Next.js (≥ 16.2.x). 2025/26 saw several Next CVEs (RSC RCE,
middleware bypass, DoS); keep it updated and rely on Vercel's platform
mitigations. Security headers + a baseline CSP are set in `next.config.ts`
(tighten to nonce-based CSP before a mainnet launch).

## Reporting

Found something? Open a private report to the maintainers before disclosing.
