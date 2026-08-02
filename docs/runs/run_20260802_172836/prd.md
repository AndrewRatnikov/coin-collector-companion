# PRD: Settings page scaffold + account info (Step 0 of Password Management & Session Refresh)

**Run:** run_20260802_172836
**Date:** 2026-08-02

## Goal

Today, coin-collector-companion has no `/settings` page and the frontend never displays any account info beyond an `isAuthenticated` boolean. This task stands up the `/settings` page itself and shows the logged-in user's own email and join date on it, per `docs/backlog_password-management.md` decision 10. It is deliberately scoped to the page scaffold and account-info display only — it does not add any password-management functionality. It exists purely so Step 1 (change password) has an existing page to extend with a form, rather than that form and the page being built as one entangled task.

## User stories

- As a logged-in user, I want to reach a `/settings` page from the site nav so that I have a discoverable place to manage my account.
- As a logged-in user, I want to see my account's email and the date I joined so that I can confirm I'm looking at the right account.
- As an unauthenticated visitor, I want `/settings` to redirect me to log in (like `/dashboard`/`/collection` already do) so that account info is never exposed to someone who isn't signed in.
- As a non-English-speaking user, I want the settings page's text to appear in my selected language so that the experience is consistent with the rest of the app.

## Acceptance criteria

1. `GET /auth/me` exists on `AuthController`, is guarded (not `@Public()`), and requires a valid access token — an unauthenticated request returns `401`.
2. `GET /auth/me` returns `{ id, email, createdAt }` for the authenticated user (the same shape as `RegisteredUser` in `auth.service.ts`) and the response body never contains a `passwordHash` key, enforced via a Prisma `select` (not solely by controller-level omission).
3. Unit tests cover: `GET /auth/me` returns the expected shape with no `passwordHash` key for an authenticated request; an unauthenticated request returns `401`.
4. `apps/web/src/lib/auth-api.ts` exports a `getCurrentUser()` function that calls `GET /auth/me`.
5. Navigating to `/settings` while authenticated renders a page (wrapped in `RequireAuth`, same pattern as `/dashboard`/`/collection`) showing a read-only account-info block with the account's email and a "member since {createdAt}" line, sourced from `getCurrentUser()`.
6. Navigating to `/settings` while unauthenticated redirects to `/login` (the existing `RequireAuth` behavior), never rendering account info.
7. The authenticated link group in `site-nav.tsx` includes a `/settings` nav link alongside `/dashboard`/`/collection`.
8. `apps/web/src/lib/i18n/locales/en.ts` and `apps/web/src/lib/i18n/locales/es.ts` both define `nav.settings`, `settings.title`, `settings.emailLabel`, and `settings.memberSinceLabel` keys — a key present in one dictionary but missing from the other is a `tsc` error per the existing i18n convention, so both must be added together.
9. A component test for the settings page's account-info block renders the email and member-since date from a mocked `getCurrentUser()` response.
10. `pnpm --filter api typecheck`, `pnpm --filter api build`, `pnpm --filter api test`, `pnpm --filter web typecheck`, `pnpm --filter web build`, `pnpm --filter web test`, and `pnpm lint` all pass cleanly.

## Out of scope

- Any change-password form or `PATCH /auth/password` endpoint — that is Step 1 of the backlog, built on top of the page this task creates.
- JWT refresh tokens, `httpOnly` cookies, `/auth/refresh`, `/auth/logout`, or any session-revocation logic — that is Step 2.
- Forgot/reset password flows, `/forgot-password`, `/reset-password`, or any email sending — that is Step 3.
- Editing the account's email or any other profile field — the email is read-only display only in this task.
- A "log out of all devices" or active-sessions UI — explicitly excluded by the backlog's "Explicitly NOT this scope" section.

## Open questions

None — `docs/backlog_password-management.md` (tasks 0.1–0.9) fully specifies the endpoint contract, response shape, UI placement, i18n keys, and test/manual-verification expectations for this step.
