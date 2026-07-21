# PRD: Auth foundation for apps/web — token storage, login/signup, Bearer attachment, route protection

**Run:** run_20260721_094026
**Date:** 2026-07-21

## Goal

`apps/web` currently has no authentication capability at all: no token storage, no login/signup UI, and `apiFetch` deliberately omits the `Authorization` header pending this decision (see the comment in `apps/web/src/lib/api-client.ts`). This is Day 1 of `docs/backlog_week3.md` — it gives a returning or new user a way to register/log in through the browser, persists their JWT client-side, makes every subsequent `apiFetch` call authenticated automatically, and stops an unauthenticated visitor from reaching auth-required routes before the API even gets a chance to reject them. It unblocks every later Week 3 day, all of which assume a working, authenticated `apiFetch`.

## User stories

- As a new visitor, I want to sign up with an email and password so that I get an account and land in the app authenticated.
- As a returning user, I want to log in with my email and password so that my session (JWT) is restored and every API call I make afterward is authenticated.
- As a logged-in user, I want my JWT attached automatically to API requests so that I don't see spurious 401s on protected data.
- As a logged-in user whose token has expired or is invalid, I want to be redirected to `/login` (with my stale token cleared) so that I'm not stuck in a broken authenticated-looking state.
- As an unauthenticated visitor, I want to be redirected away from account-only pages (`/dashboard`, `/collection`, `/sets/new`, `/sets/[id]`) to `/login`, without being blocked from anonymous-read pages (`/catalog`, `/sets/canonical`, `/sets/public`, etc.).

## Acceptance criteria

1. `apps/web/src/lib/auth-token.ts` exports `getStoredToken`, `setStoredToken`, `clearStoredToken` backed by `localStorage`; each is SSR-safe — when `typeof window === 'undefined'`, `getStoredToken` returns `null` and `setStoredToken`/`clearStoredToken` are no-ops (verifiable by calling them in a non-DOM/mocked environment).
2. `apps/web/src/lib/auth-api.ts` exports `register(email, password)` and `login(email, password)`, each POSTing to `/auth/register` / `/auth/login` via the existing `apiFetch`, and on a successful response storing the returned `accessToken` via `setStoredToken` from (1).
3. `apps/web/src/lib/api-client.ts`'s `apiFetch`:
   - attaches `Authorization: Bearer <token>` to outgoing requests when `getStoredToken()` returns a non-null token, and omits the header entirely when it does not;
   - on any response with HTTP status `401`, calls `clearStoredToken()` and redirects the browser to `/login` before throwing;
   - the existing `// Auth header attachment ... was removed here pending the v2 auth decision` comment is removed, since this criterion resolves that decision.
4. `apps/web/src/app/login/page.tsx` and `apps/web/src/app/signup/page.tsx` exist as client components (`'use client'`), each rendering an email/password form built from the existing `FormField` component; each submits through (2)'s `login`/`register`; on success both redirect to `/dashboard`; on a rejected submission (e.g. the API's 401/409), the failure is mapped through the existing `lib/form-errors.ts` convention and shown as a form-level/field-level error rather than an unhandled exception or blank failure.
5. A reusable client-side auth guard (e.g. a wrapper component or hook, not a literal Next.js `middleware.ts` — the JWT lives in `localStorage`, unreadable at the edge) exists and, when applied to a route, redirects a visitor with no stored token to `/login`. It is applied to a minimal placeholder `/dashboard` page (`apps/web/src/app/dashboard/page.tsx`) created in this task so the login/signup redirect target in (4) is real and the guard has at least one live integration point. The guard is documented (code comment or README-level note) as the mechanism `/collection`, `/sets/new`, and `/sets/[id]` will each apply once those pages exist (Day 3/4) — building those pages themselves is out of scope here.
6. Pages that must remain anonymous-reachable (`/catalog`, `/catalog/[coinId]`, `/sets/canonical`, `/sets/canonical/[id]`, `/sets/public`, `/sets/public/[id]`) are not touched by this task and nothing added here imposes a guard on them (verifiable by inspection — the guard from (5) is opt-in per route, not global).

## Out of scope

- Building the real `/collection`, `/sets/new`, `/sets/[id]`, or a non-placeholder `/dashboard` page — those are Day 3/4 work; this task only proves the guard mechanism works via a placeholder `/dashboard`.
- Any backend/API change (Week 1/2 already closed the API surface; a UI need surfacing a real API gap is a scope bug to flag, not something to patch in here).
- The manual browser QA pass described in backlog item 1.6 (register/login/logout/redirect click-through with a real throwaway user against a live dev server) — that is a human/manual step outside this automated pipeline's scope, and is explicitly deferred, not skipped.
- Top-level navigation, styling pass, or any Day 2–5 backlog item (catalog browsing, sets, dashboard content, gap view, collection page, cleanup).
- `is_public` per-set privacy UI, theme/tag filtering, Numista/CSV import, deploy verification — all already out of scope per the backlog's own "Explicitly NOT this week" section.

## Open questions

- `apps/web` has no test framework configured today (no test script, no existing `*.test.*`/`*.spec.*` files under `apps/web`, `repo-digest.md`'s Test command reports `UNKNOWN`). The Architect needs to decide and set up minimal test infra (most likely Vitest, consistent with the rest of the stack's tooling conventions) as part of this task's Interface Contract, scoped to what's needed to unit-test (1)-(3) and, if feasible, component-test (4)-(5) — rather than treating "no existing framework" as a reason to skip automated tests for this task.
