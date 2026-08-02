# PRD: Change password (Step 1 of Password Management)

**Run:** run_20260802_183303
**Date:** 2026-08-02

## Goal

A logged-in user of Coin Collector Companion currently has no way to change their own password from within the app — the only fix today is a hand-run SQL update against the Neon database. This task adds a self-service change-password capability: an authenticated user, knowing their current password, can set a new one from the `/settings` page (already scaffolded in Step 0 with a read-only account-info block). This is Step 1 of a four-step password-management backlog (`docs/backlog_password-management.md`); it deliberately ships without cross-session revocation on password change (decision 6) since that requires the refresh-token machinery Step 2 builds — Step 2 retrofits that in later (task 2.7). That gap is a known, accepted, and out-of-scope-for-this-task consequence of the documented build order, not an oversight.

## User stories

- As a logged-in user, I want to change my password from `/settings` by entering my current password and a new one, so that I can rotate my credentials without needing DB access.
- As a logged-in user, I want the change to be rejected if I enter the wrong current password, so that someone with a stolen but still-valid session token can't silently take over my account by resetting the password.
- As a logged-in user, I want to see a clear success message when my password is changed and a clear error message when it isn't, so that I know whether the action took effect.
- As a returning user, I want to log in with my new password (and have my old password stop working) immediately after changing it, so that the change is trustworthy.

## Acceptance criteria

1. `PATCH /auth/password` exists on `AuthController`, guarded (no `@Public()`), accepting `{ currentPassword, newPassword }` via a new `ChangePasswordDto` with `@MinLength(8)` on `newPassword` (matching `RegisterDto`'s existing convention).
2. `AuthService.changePassword` verifies `currentPassword` against the stored `passwordHash` via `bcrypt.compare`; on mismatch, the request is rejected with 401 and no write occurs to the database.
3. On a correct `currentPassword`, the new password is hashed (`bcrypt`, matching `register`'s existing hashing convention) and persisted, replacing the stored `passwordHash`.
4. Unit tests (mocked Prisma, existing `auth.service.spec.ts`/`auth.controller.spec.ts` convention) cover: wrong `currentPassword` → 401 with no persisted write; correct `currentPassword` → the new password is hashed and saved.
5. `apps/web/src/lib/auth-api.ts` exposes a `changePassword(currentPassword, newPassword)` function that calls `PATCH /auth/password`.
6. The `/settings` page (from Step 0) is extended with a change-password form (current password, new password fields) below the existing read-only account-info block, reusing the existing `FormField` component and `lib/form-errors.ts` convention already used by `login`/`signup`. Submitting calls `changePassword`.
7. The form shows a success message on a successful change and a field-level or form-level error message when the current password is wrong, without needing a page reload.
8. New i18n keys for the password-form labels, submit button, and success/error messages are added to **both** `apps/web/src/lib/i18n/locales/en.ts` and `es.ts` in the same change (a one-sided addition is a `tsc` error per this repo's existing i18n convention).
9. A component test for the settings page covers the change-password form's happy path (successful submission shows success state) and the wrong-current-password error case, extending the existing `settings/page.test.tsx` from Step 0.
10. `pnpm --filter api typecheck`/`build`/`test` and `pnpm --filter web typecheck`/`build`/`test` and `pnpm lint` all pass.

## Out of scope

- **Cross-session revocation on password change** (decision 6 / task 2.7) — requires the refresh-token table Step 2 introduces; deliberately deferred, not a gap to fill here.
- **Forgot/reset password** (logged-out flow, Step 3) and **JWT refresh tokens** (Step 2) — separate steps in the same backlog, not touched by this task.
- **Manual live-DB verification pass** (backlog task 1.7: log in, change password, log out, confirm old password fails and new one works against the real Neon dev DB) — the automated pipeline has no real DB credentials in its sandbox; this is left as a documented manual follow-up, not something the Coder/sandbox stages execute (consistent with this repo's established convention per prior runs).
- **Password strength rules beyond `@MinLength(8)`** — no complexity/entropy requirements, no breached-password check; explicitly excluded by the backlog itself ("Explicitly NOT this scope").
- **A "log out of all devices" / active-sessions UI** — explicitly excluded by the backlog.

## Open questions

None — the backlog document (`docs/backlog_password-management.md`, decisions 1–10 and Step 1 tasks 1.1–1.8) fully specifies scope, contracts, and UI placement for this step.
