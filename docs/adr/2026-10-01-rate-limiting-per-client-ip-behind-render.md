# Rate limits are per client IP, using an explicit proxy hop count

- **Status:** Accepted. Supersedes the "no rate limiting anywhere" position in `docs/system-design_v2.md` (§5 and §7).
- **Date:** 2026-10-01
- **Source:** orchestrator run `run_20261001_071514`
- **Code:** `apps/api/src/configure-app.ts` (`configureApp`, `parseTrustProxyHops`), `apps/api/src/main.ts`, `render.yaml` (`TRUST_PROXY_HOPS`), `apps/api/.env.example`, `@Throttle` on `catalog.controller.ts` and `feedback.controller.ts`, `apps/api/test/rate-limit.e2e-spec.ts`

## Context

`@nestjs/throttler` already guarded the auth routes (`/auth/register` and `/auth/login` 5 per minute, `/auth/forgot-password` 3 per hour, `/auth/reset-password` 5 per minute). But `main.ts` never set Express `trust proxy`. On Render the API sits behind a load balancer, so `req.ip` was the proxy's address and **every visitor shared one bucket**: the per-client limits were effectively site-wide. `POST /catalog` and `POST /feedback` had only the global 100 per minute.

## Decision

- App setup moves into `configureApp(app)`. `main.ts` and the e2e tests both call it, so the tests exercise the real setup.
- Express `trust proxy` is set to an **integer hop count** from `TRUST_PROXY_HOPS`: default `0` (trust nothing, for local dev), `1` in `render.yaml`. An invalid value falls back to `0` with a startup warning. **Never `true`**, which would let clients spoof `X-Forwarded-For` to dodge limits. With `1`, `req.ip` is the rightmost `X-Forwarded-For` entry, which a client can't forge by prepending entries.
- New limits: `POST /catalog` 20 per hour, `POST /feedback` 5 per hour. Auth limits are unchanged.
- Tracking stays **per IP, not per user**. The global guard order is `ThrottlerGuard` before `JwtAuthGuard`, so the throttler can't see `req.user`. This also means anonymous calls to guarded routes are counted.

## Alternatives considered

- **`trust proxy: true`.** Rejected because of spoofing.
- **Per-user throttling or CAPTCHA.** Out of scope.

## Consequences

- **The hop count of 1 on Render is an assumption.** After a deploy, log `req.ip` once and confirm it is the real client IP. If the count is too low, buckets stay shared (no spoofing). If it is too high, clients can spoof.
- Users behind a shared NAT (offices, mobile carriers) share a bucket.
- `rate-limits.spec.ts` reads the throttler's internal metadata keys (`'THROTTLER:LIMITdefault'`), so it may need updating on a `@nestjs/throttler` upgrade. The e2e test stays the behavioural check.
