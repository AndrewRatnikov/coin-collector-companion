# PRD: JWT refresh tokens (Step 2 of password-management backlog)

**Run:** run_20260802_221803
**Date:** 2026-08-02

## Goal

Today the API (`apps/api/src/auth`) issues a single fixed 7-day JWT with no refresh and no server-side revocation — a copied/stolen token stays valid for a week no matter what, and "logout" is purely client-side. This task replaces that with a rotating, server-revocable session: a short-lived (15 min) access token plus a longer-lived (20 day), rotate-on-use refresh token stored server-side (hashed) in a new `RefreshToken` table. It also retrofits Step 1's change-password endpoint (`PATCH /auth/password`, already shipped) with the session-revocation behavior it deliberately launched without, so changing your password now actually ends every other active session. This is Step 2 of the four-step backlog in `docs/backlog_password-management.md`; Steps 0 (settings scaffold) and 1 (change password) are already shipped.

## User stories

- As a logged-in user, I want my session to keep working past the access token's 15-minute expiry without me noticing, so a short-lived access token doesn't force me to re-login constantly.
- As a user, I want logging out to actually end my session server-side, so a copied-out refresh-token cookie stops working the moment I log out, not just when I stop sending it.
- As a user, I want changing my password to log out every other device/session using my account, so a compromised session can't keep using my old credentials after I've reacted to it.
- As the API, I want a reused (already-rotated-out) refresh token to revoke the entire session chain it came from, so a stolen refresh token gets a bounded, self-limiting blast radius instead of indefinite validity.
- As a frontend user, I want a 401 from an expired access token to trigger a silent refresh-and-retry, so the app doesn't visibly log me out every 15 minutes.

## Acceptance criteria

1. `apps/api/prisma/schema.prisma` has a `RefreshToken` model — `id`, `userId` (FK → `User.id`, `onDelete: Cascade`), `tokenHash` (unique), `expiresAt`, `revokedAt DateTime?`, `familyId`, `createdAt` — with a migration generated and applied.
2. `cookie-parser` (+ `@types/cookie-parser`) is a dependency of `apps/api`; `app.use(cookieParser())` is wired in `apps/api/src/main.ts`. CORS (`app.enableCors(...)`) sets `credentials: true` with an explicit allow-list of origins (no wildcard/undefined origin, required for credentialed CORS per the Fetch spec).
3. `apps/api/src/auth/token.service.ts` exports: `issue(userId, familyId?)` (creates a `RefreshToken` row, new `familyId` if none given, returns the raw token); `rotate(rawToken)` (looks up by hash — if already `revokedAt`, revokes every row sharing its `familyId` and rejects; otherwise revokes this row and issues a new one in the same family); `revokeAllForUser(userId)`; `revokeOne(rawToken)`. Raw tokens are never stored — only hashes.
4. JWT access-token lifetime is `15m` (was `7d`). `AuthService.login`/`register` also call `TokenService.issue` and set the raw refresh token as an `httpOnly`, `Secure`, `SameSite=Lax` cookie with a 20-day `maxAge` on the response; the JSON response body is unchanged (still only the access token).
5. `POST /auth/refresh` is `@Public()`, reads the refresh token from the cookie (not the body), calls `TokenService.rotate`, sets the new rotated cookie, and returns `{ accessToken }` as JSON. A missing, invalid, expired, or already-rotated-out cookie returns 401.
6. `POST /auth/logout` reads the refresh cookie, calls `TokenService.revokeOne`, and clears the cookie. It is idempotent — a missing or already-invalid cookie is a no-op, not an error.
7. `AuthService.changePassword` (existing, from Step 1) also calls `TokenService.revokeAllForUser` after a successful password change.
8. Unit tests cover: `rotate` on a valid token issues a new token in the same `familyId`; `rotate` on an already-revoked token revokes every row in that `familyId` and rejects; `changePassword`'s existing test is extended to assert `revokeAllForUser` is called on success.
9. A new `apps/api/test/auth-refresh.e2e-spec.ts` covers: login sets a refresh cookie; `POST /auth/refresh` with that cookie returns a new access token and a rotated cookie; replaying the original (now-rotated-out) cookie → 401; a follow-up refresh with the *new* cookie also then fails (proves the whole family was revoked, not just the one row); `POST /auth/logout` then `POST /auth/refresh` with the same cookie → 401.
10. `apps/web/src/lib/api-client.ts`: every `fetchWithTimeout` call sends `credentials: 'include'`. On a 401 from any endpoint other than `/auth/refresh` itself, the client attempts one `refreshAccessToken()` call before falling back to today's clear-token-and-redirect behavior; on success it stores the new access token and retries the original request. Refresh is never itself retried recursively on its own 401.
11. `apps/web/src/lib/auth-api.ts` gains `refreshAccessToken()` (`POST /auth/refresh`, stores the new access token) and `logout()` (`POST /auth/logout`, awaited, then clears the locally stored token).
12. `apps/web/src/components/layout/site-nav.tsx`'s `handleLogout` becomes `async` and awaits the new `logout()` before clearing local state and redirecting.
13. `pnpm --filter api typecheck`/`build`/`test`/`test:e2e`, `pnpm --filter web typecheck`/`build`/`test`, and `pnpm lint` all pass clean.

## Out of scope

- **Step 3 (forgot/reset password)** — a separate, later step in the same backlog; not part of this task.
- **A "log out of all devices" / active-sessions UI** — the backlog explicitly defers this; the revocation machinery this task builds makes it *possible* later, but no session-listing UI is built here.
- **Task 2.13 (manual/live pass against the real Neon dev DB)** — this pipeline runs in an automated sandbox against a test database and cannot perform live manual browser verification or send real traffic to shared dev infra. Acceptance criteria 8–9 (unit + e2e tests) are the automated substitute; the live manual pass remains a follow-up for the user after this run.
- **Task 4.3 (CLAUDE.md changelog entry)** — a wrap-up task spanning all four backlog steps together, not scoped to Step 2 alone.
- **Moving the access token off `localStorage`, MFA, email verification, password-strength rules** — all explicitly excluded by the backlog's "Explicitly NOT this scope" section and unaffected by this task.

## Open questions

- Task 2.13's live DB pass and the Wrap-up section's cross-step tasks (4.1–4.3) are intentionally left for the user post-pipeline — flagged above under Out of scope rather than repeated here.
- `apps/api/test/auth.e2e-spec.ts` already exists, implying an existing e2e test harness/DB fixture convention for this repo; the Architect and Tester should follow that existing convention for the new `auth-refresh.e2e-spec.ts` rather than inventing a new one.
