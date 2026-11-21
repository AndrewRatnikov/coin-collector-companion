# Web and API move under one registrable domain, so the SameSite=Lax refresh cookie is same-site and works unchanged

- **Status:** Accepted
- **Date:** 2026-11-21
- **Source:** orchestrator run `run_20261121_160034` (custom domain `coincompanion.app`; the user's task fixed the decision and the rejected alternative)
- **Code:** `apps/api/src/configure-app.ts`, `apps/api/src/auth/password-reset.service.ts`, `apps/api/src/auth/token.service.ts`, `render.yaml`

## Context

The web app was served from `*.vercel.app` and the API from `*.onrender.com`. Both suffixes are on the Public Suffix List, so the two hosts are different registrable domains and therefore different sites. The API sets the refresh token as an `httpOnly` cookie with `SameSite=Lax` (`apps/api/src/auth/token.service.ts`). For a credentialed `fetch` from the web app to the API, that cookie is cross-site: browsers neither store it from the login response nor send it on the refresh request. The access token lives for 15 minutes, so every session ended when it expired, and the user had to sign in again.

## Decision

Web and API are served under one registrable domain, `coincompanion.app`: the web app on Vercel at the apex, the API on Render at `api.coincompanion.app`. The two hosts are then same-site, so the `SameSite=Lax` refresh cookie is stored and sent on the web app's credentialed requests to the API without any change. The refresh cookie options are not changed.

Supporting changes:

- `CORS_ORIGIN` accepts a comma-separated list of exact origins (parsed by `parseCorsOrigins` in `apps/api/src/configure-app.ts`; entries trimmed, empty ones dropped), so the apex and any alias can be allowed together. `http://localhost:3000` stays allowed and `credentials: true` is unchanged.
- When `FRONTEND_URL` is unset, password-reset links fall back to the **first** `CORS_ORIGIN` entry, never the raw list.
- `render.yaml` lists `FRONTEND_URL`, `EMAIL_FROM` and `RESEND_API_KEY` as `sync: false`, so the blueprint names every variable the service needs.
- The domain is configuration only (Render and Vercel env vars, DNS); no application code names it.

## Alternatives considered

- **`SameSite=None; Secure` on the refresh cookie, keeping web on `vercel.app` and the API on `onrender.com`:** keeps the cross-site setup, but a cookie sent on cross-site requests needs CSRF protection on every cookie-authenticated endpoint, and it still fails in browsers that block third-party cookies (Safari by default, others increasingly), so sessions would still end after 15 minutes for those users. Rejected.
- **Proxy the API through Next.js rewrites on the web origin:** makes the cookie first-party, but routes all API traffic through Vercel and blurs the separate web/API services described in `CLAUDE.md`. Rejected.

## Consequences

- Sessions on `coincompanion.app` outlive the 15-minute access token, with no auth code change and no new CSRF surface.
- It depends on the DNS layout: web on Vercel at the apex, API on Render at `api.`, the Resend sending domain at `mail.`, all records DNS-only (not proxied) in Cloudflare.
- The old `*.vercel.app` and `*.onrender.com` URLs keep working as before, including the 15-minute session limit; they are cross-site to each other.
- Operators must set `CORS_ORIGIN` entries exactly as the browser sends the origin (scheme and host, no trailing slash); entries are not normalised.
- Not yet verified in production: growth backlog item 0.8 stays unticked until a manual pass (password reset to a non-owner address, and a session that outlives 15 minutes on `coincompanion.app`).
