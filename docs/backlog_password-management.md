# Password Management & Session Refresh — Decisions

Not yet in [docs/prd_v2.md](prd_v2.md)'s Requirements list — the PRD's "v2 / Post-MVP Direction" section only mentions "Token refresh" as a captured-but-unscheduled idea. This doc records the scope and build decisions made in chat on 2026-07-31, on top of that. The checklist below is the resulting task backlog, in the same style as [docs/backlog_catalog-contributions.md](backlog_catalog-contributions.md), but split into four sequential steps (decision 3) rather than one flat backend/frontend split — each step is independently shippable and gets its own checkpoint.

## Why this came up

Today's auth (`apps/api/src/auth`) has no self-service account recovery: a forgotten password can only be fixed by hand in the Neon DB (`UPDATE users SET password_hash = ...`). Fine at "one real user" scale, not fine past it. Discussed alongside it: the JWT session itself is a single fixed 7-day token with no refresh and no server-side revocation.

## Decisions

1. **Scope — build three features, not just password reset:**
   - **Change password** (logged in) — a user updates their own password given their current one.
   - **Forgot / reset password** (logged out) — email a reset link to a locked-out user.
   - **JWT refresh tokens** — short-lived access token + longer-lived, server-side-revocable refresh token, replacing today's single fixed 7-day token.

2. **Free tier — confirmed feasible for all three.** No paid infra required:
   - Change password and refresh tokens need no new external service — just new DB tables (Neon free tier).
   - Forgot/reset password needs transactional email. Recommended provider: **Resend** — free tier is 3,000 emails/month / 100/day, no card required. Caveat: reliably sending to arbitrary recipients needs a verified sending domain (free, just DNS records) — this project doesn't have a custom domain wired up yet (Vercel/Render are both on default domains today). Until one exists, Resend still sends free to your own account email with zero setup, which covers the "single real user" case; add domain verification once a second real user needs a reset email.

3. **Build order — Step 0: Settings page scaffold, Step 1: Change password, Step 2: Refresh tokens, Step 3: Forgot/reset password.** No hard technical requirement — each step is independently shippable on its own — but this order minimizes rework, with one deliberate consequence spelled out here so it isn't mistaken for an oversight later: decision 6 (below) wants both change-password *and* reset-password to revoke a user's other sessions, but that's only possible once the refresh-token table (Step 2) exists. Building change-password first (Step 1) therefore ships *without* that revocation at first, on purpose — Step 2 comes back and retrofits it in (task 2.7 below) once the machinery exists. Reset-password (Step 3), built after Step 2, gets the revocation call for free from the start, no retrofit needed — this asymmetry is exactly why refresh tokens are sequenced before reset-password rather than after. Step 0 (added 2026-07-31) exists purely to stand up the `/settings` page itself and show the account's email on it, ahead of Step 1 dropping the change-password form onto that same page — see decision 10.

4. **UI surface:**
   - Change password needs the authenticated **`/settings`** page Step 0 scaffolds (wrapped in `RequireAuth`, same pattern as `/dashboard`/`/collection`), with a nav link added to `site-nav.tsx`. No such route or nav link exists today — Step 1 adds the change-password form onto the page Step 0 creates, rather than creating its own.
   - Forgot/reset password needs two new **public** pages — `/forgot-password` (email form) and `/reset-password` (reads a token from the URL, new-password form) — reachable via a "Forgot password?" link on `/login`, not from settings.
   - Refresh tokens need no page of their own (a future "log out of all devices" button could live on the settings page, but isn't required for this work — see "Explicitly NOT this scope" below).

5. **Refresh-token mechanics:**
   - **Client-side storage: `httpOnly` cookie**, not `localStorage` — chosen over the simpler localStorage option for the security benefit (unreadable by injected scripts), accepted the cost of cookie-based CORS (`credentials: true` on both the API's CORS config and every `apiFetch` call, since web and API are on different origins). The **access token is unaffected** — it keeps its current `localStorage` + `Authorization: Bearer` treatment, since its 15-minute TTL makes it the non-sensitive half of the pair.
   - **Server-side storage: a DB record (hashed token, not the raw value).**
   - **Access token lifetime: 15 minutes. Refresh token lifetime: 20 days.**
   - **Rotation: rotate-on-use** — each `POST /auth/refresh` call issues a new refresh token and invalidates the one just used. A reused, already-rotated-out token signals theft and revokes the whole session chain (its `familyId`).

6. **Session revocation on password change: yes, for both flows** — see decision 3's note on how this actually lands (Step 1 ships without it, Step 2 retrofits it, Step 3 gets it from the start).

7. **Rate limiting on `/auth/forgot-password`: 3 requests/hour per IP.** Reuses the existing `ThrottlerModule` mechanism `/auth/login` already applies via `@Throttle` (`apps/api/src/auth/auth.controller.ts`), just a stricter window.

8. **Schema:**
   ```
   PasswordResetToken: id, userId, tokenHash, expiresAt, usedAt
   RefreshToken:        id, userId, tokenHash, expiresAt, revokedAt, familyId
   ```
   `familyId` groups every token descended from one original login (rotation reissues a new token under the same `familyId`), so both "revoke everything from this login" (decision 6) and "revoke this whole chain on reuse-detected theft" (decision 5) are a single `updateMany({ where: { familyId } })`.

9. **Endpoint contracts:**
   ```
   PATCH /auth/password        { currentPassword, newPassword }
   POST  /auth/forgot-password { email }
   POST  /auth/reset-password  { token, newPassword }
   POST  /auth/refresh         (refresh token read from the httpOnly cookie, not the request body)
   POST  /auth/logout          (revokes the current refresh token, clears the cookie)
   ```
   `/auth/refresh`'s response carries the new access token as a normal JSON body value (not a cookie) — only the refresh token gets cookie treatment. `/auth/logout` is new: today "logout" is purely client-side (`clearStoredToken()`), which no longer actually ends the session once a server-tracked refresh token exists (Step 2) — without this endpoint, a copied-out refresh-token cookie would keep working after a user thinks they've logged out.

10. **Settings page shows the account's email — decided 2026-07-31.** Read-only, sourced from a new `GET /auth/me` endpoint (guarded, returns the same `{ id, email, createdAt }` shape `AuthService.register` already returns as `RegisteredUser` — no new interface needed) rather than decoding the JWT client-side, since the JWT's `email` claim is an implementation detail of the token, not a stable contract to build UI on. This is Step 0, built before Step 1's change-password form so the page exists for that form to be added to rather than the two being built as one entangled task.

**Current relevant state, so the tasks below don't re-derive it:** `apps/api/src/auth` is `auth.module.ts`/`.controller.ts`/`.service.ts` + `dto/{login,register}.dto.ts` + `guards/jwt-auth.guard.ts` + `strategies/jwt.strategy.ts` + `decorators/{public,current-user}.decorator.ts` — only `register`/`login` exist today, both issuing a single 7-day HS256 token via `JwtModule.registerAsync` (`auth.module.ts`), no refresh/logout/password-change/reset/`me` endpoints. `apps/api/prisma/schema.prisma`'s `User` model has no relations besides `userSets`/`ownerships`/`submittedCoins` — no token tables. `apps/api/src/main.ts`'s `app.enableCors({ origin: [...] })` has no `credentials: true` and the app has no cookie parser installed (`cookie-parser` is not in `apps/api/package.json`). `apps/web/src/lib/api-client.ts`'s `apiFetch` reads the access token from `localStorage` (`auth-token.ts`) and, on any 401 with a token attached, clears it and hard-redirects to `/login` — no refresh attempt exists, and no fetch call sets `credentials: 'include'`. `apps/web/src/components/layout/site-nav.tsx`'s `handleLogout` is synchronous and purely local (`clearStoredToken()`), no API call; it has no `/settings` link. `apps/web/src/lib/i18n/locales/{en,es}.ts` are the two dictionaries every new UI string needs an entry in (this is what makes a missing translation a `tsc` error, per `CLAUDE.md`'s 2026-07-27 localization entry). No `/settings`, `/forgot-password`, or `/reset-password` route exists in `apps/web/src/app`, and the frontend never decodes or displays any user info today beyond the `isAuthenticated` boolean derived from whether a token is present.

---

## Step 0: Settings page scaffold + account info

Stands up `/settings` itself and shows the account's email on it (decision 10), ahead of Step 1 dropping a change-password form onto the same page.

- [x] 0.1 New `GET /auth/me` on `AuthController` — guarded (no `@Public()`), takes `@CurrentUser()`. `AuthService.me(userId)` returns the same `{ id, email, createdAt }` shape as `RegisteredUser` (already defined in `auth.service.ts`, reused as-is — no new interface). A `select` excluding `passwordHash` (same defense-in-depth reasoning `CatalogService`'s `submittedByUserId` omission already follows — never rely on the controller alone to keep a sensitive field out of the response).
- [x] 0.2 Unit tests: `GET /auth/me` returns the expected shape with no `passwordHash` key; unauthenticated request → 401.
- [x] 0.3 `apps/web/src/lib/auth-api.ts`: add `getCurrentUser()` (`GET /auth/me`).
- [x] 0.4 New `apps/web/src/app/settings/page.tsx` — `RequireAuth`-wrapped, fetches 0.3's `getCurrentUser()` and renders a read-only account-info block (email, plus "member since {createdAt}"). This is the page Step 1 extends with the change-password form — deliberately built as its own task first rather than entangled with that form.
- [x] 0.5 `apps/web/src/components/layout/site-nav.tsx`: add a `/settings` nav link next to `/dashboard`/`/collection` in the authenticated link group. (Landed inside a new `AccountMenu` dropdown component rather than directly in `site-nav.tsx`'s row — an unrelated prior change collapsed the authenticated links behind one trigger — but the link exists and is wired to real auth state either way.)
- [x] 0.6 `apps/web/src/lib/i18n/locales/en.ts` and `es.ts`: add `nav.settings`, `settings.title`, `settings.emailLabel`, `settings.memberSinceLabel` keys to **both** files (a missing translation is a `tsc` error by design, per the existing i18n convention — add both together, not one now and the other later).
- [x] 0.7 Component test for the settings page's account-info block, following the existing convention — renders the email and member-since date from a mocked `getCurrentUser()` response.
- [x] 0.8 Manual pass against the real Neon dev DB: log in, open `/settings`, confirm the displayed email matches the logged-in account and the member-since date matches `createdAt`. Clean up the throwaway user afterward.
- [x] 0.9 `pnpm --filter api typecheck`/`build`/`test`, `pnpm --filter web typecheck`/`build`/`test`, `pnpm lint` all clean.

**Checkpoint 0:** a logged-in user can reach `/settings` (linked from the nav) and see their account's email and join date. No password-management functionality yet — that arrives in Step 1.

## Step 1: Change password

Ships without cross-session revocation (decision 3) — Step 2 retrofits that in (task 2.7).

- [x] 1.1 New `ChangePasswordDto` (`currentPassword`, `newPassword`, same `@MinLength(8)` as `RegisterDto`) and `PATCH /auth/password` on `AuthController` — guarded (no `@Public()`), takes `@CurrentUser()`. `AuthService.changePassword`: verify `currentPassword` via `bcrypt.compare` against the stored hash (401 if wrong), hash and save `newPassword`.
- [x] 1.2 Unit tests (`auth.service.spec.ts`/`auth.controller.spec.ts`, mocked Prisma, existing convention): wrong `currentPassword` → 401 and no write; correct call hashes and persists the new password.
- [x] 1.3 `apps/web/src/lib/auth-api.ts`: add `changePassword(currentPassword, newPassword)` (`PATCH /auth/password`).
- [x] 1.4 Extend the `/settings` page Step 0 built (`apps/web/src/app/settings/page.tsx`) with a `currentPassword`/`newPassword` form below the read-only account-info block, reusing the existing `FormField` component and `lib/form-errors.ts` convention (same pattern as `login`/`signup`), calling 1.3's `changePassword` on submit.
- [x] 1.5 `apps/web/src/lib/i18n/locales/en.ts` and `es.ts`: add the password-form-specific `settings.*` keys (current/new password labels, submit button, success/error messages) to **both** files — `nav.settings`/`settings.title` already exist from Step 0.
- [x] 1.6 Extend Step 0's settings-page component test with the change-password form's happy path plus the wrong-current-password error case.
- [x] 1.7 Manual pass against the real Neon dev DB: log in, change password via `/settings`, log out, confirm login with the *old* password now fails and the *new* one succeeds. Clean up the throwaway user afterward.
- [x] 1.8 `pnpm --filter api typecheck`/`build`/`test`, `pnpm --filter web typecheck`/`build`/`test`, `pnpm lint` all clean.

**Checkpoint 1:** a logged-in user can change their own password from `/settings`. No other-session revocation yet — that arrives in Step 2.

## Step 2: JWT refresh tokens

Replaces today's single fixed 7-day token with a rotating, revocable pair, and retrofits Step 1's endpoint with the session revocation decision 6 wants.

- [x] 2.1 `apps/api/prisma/schema.prisma`: add a `RefreshToken` model (`id`, `userId` FK → `User.id` `onDelete: Cascade`, `tokenHash` unique, `expiresAt`, `revokedAt DateTime?`, `familyId`, `createdAt`) per decision 8. Generate + apply a migration against the real Neon dev DB.
- [x] 2.2 Add `cookie-parser` (+ `@types/cookie-parser`) to `apps/api/package.json`; wire `app.use(cookieParser())` into `apps/api/src/main.ts`. Change `app.enableCors(...)` to add `credentials: true` and stop allowing a wildcard/undefined origin — every allowed origin must be an explicit string for credentialed CORS to work per the Fetch spec.
- [x] 2.3 New `apps/api/src/auth/token.service.ts` — generation, hashing (never store raw tokens, same principle passwords already follow), and rotation/reuse-detection logic: `issue(userId, familyId?)` creates a new `RefreshToken` row (new `familyId` if none given) and returns the raw token; `rotate(rawToken)` looks up by hash — if `revokedAt` is already set (this token was already used/rotated-out), revokes every row sharing its `familyId` and rejects; otherwise revokes this row and issues a new one in the same family; `revokeAllForUser(userId)` and `revokeOne(rawToken)` (for logout) as separate helpers.
- [x] 2.4 `AuthModule`/`JwtModule.registerAsync`: change `signOptions.expiresIn` from `'7d'` to `'15m'`. `AuthService.login` now also calls `TokenService.issue` and returns both the access token and the raw refresh token; `AuthController.login`/`register` take `@Res({ passthrough: true })` to set the refresh token as an `httpOnly`, `Secure`, `SameSite=Lax` cookie (20-day `maxAge`) on the response, while the JSON body keeps returning only the access token — no change to the existing response shape callers see.
- [x] 2.5 `POST /auth/refresh` — `@Public()` (it authenticates via the refresh cookie, not a bearer access token), reads the cookie, calls `TokenService.rotate`, sets the new refresh-token cookie, returns `{ accessToken }` as JSON. A missing/invalid/expired/already-rotated cookie → 401.
- [x] 2.6 `POST /auth/logout` — reads the refresh cookie, calls `TokenService.revokeOne`, clears the cookie (`res.clearCookie`). Idempotent on an already-logged-out/missing cookie (no error, just a no-op).
- [x] 2.7 **Retrofit Step 1:** `AuthService.changePassword` (task 1.1) now also calls `TokenService.revokeAllForUser` after a successful change, so every other active session is logged out by this change (decision 6) — the piece Step 1 deliberately shipped without.
- [x] 2.8 Unit tests: `TokenService.rotate` on a valid token issues a new one in the same `familyId`; `TokenService.rotate` on an already-revoked token revokes every row in that `familyId` and rejects; the updated `changePassword` test (1.2) now also asserts `revokeAllForUser` is called on success.
- [x] 2.9 New `apps/api/test/auth-refresh.e2e-spec.ts` covering what a mocked-Prisma unit test can't: login sets a refresh cookie; `POST /auth/refresh` with that cookie returns a new access token and a rotated cookie; replaying the *original* (now-rotated-out) refresh cookie → 401, and a follow-up refresh attempt with the *new* cookie also fails (confirms the whole family was revoked, not just the one row); `POST /auth/logout` then `POST /auth/refresh` with the same cookie → 401.
- [x] 2.10 `apps/web/src/lib/api-client.ts`: add `credentials: 'include'` to every `fetchWithTimeout` call so the browser sends the refresh-token cookie. On a 401 *from an endpoint other than `/auth/refresh` itself*, before clearing the token and redirecting: call a new `refreshAccessToken()` once, and if it succeeds, store the new access token and retry the original request; only fall through to the existing clear-and-redirect behavior if the refresh attempt itself fails. Guard against infinite recursion (never attempt a refresh in response to `/auth/refresh`'s own 401).
- [x] 2.11 `apps/web/src/lib/auth-api.ts`: add `refreshAccessToken()` (`POST /auth/refresh`, stores the returned access token via `setStoredToken`) and `logout()` (`POST /auth/logout`, then `clearStoredToken()` — awaited, not fire-and-forget, so the server-side revocation actually completes).
- [x] 2.12 `apps/web/src/components/layout/site-nav.tsx`: `handleLogout` becomes `async`, calling 2.11's `logout()` before clearing local state and redirecting — today's purely-client-side logout no longer actually ends the session once a server-tracked refresh token exists.
- [x] 2.13 Manual/live pass against the real Neon dev DB: log in, confirm a refresh cookie was set (browser devtools); wait past 15 minutes (or shorten the TTL temporarily) and confirm the next authenticated action refreshes silently with no visible interruption; log out and confirm the refresh cookie no longer works even if replayed directly; change password via `/settings` (Step 1) in one session and confirm a *second* logged-in session for the same user is now logged out on its next request. Clean up the throwaway user afterward.
- [x] 2.14 `pnpm --filter api typecheck`/`build`/`test`/`test:e2e`, `pnpm --filter web typecheck`/`build`/`test`, `pnpm lint` all clean.

**Checkpoint 2:** sessions now use a rotating, short-lived (15 min) access token plus a server-revocable 20-day refresh token in an `httpOnly` cookie — a session survives access-token expiry transparently, and logout or a password change (Step 1, retrofitted here) actually end it server-side, not just client-side.

## Step 3: Forgot / reset password

Built last so it gets Step 2's session-revocation call for free from the start (decision 3) — no retrofit needed, unlike Step 1.

- [ ] 3.1 `apps/api/prisma/schema.prisma`: add a `PasswordResetToken` model (`id`, `userId` FK → `User.id` `onDelete: Cascade`, `tokenHash` unique, `expiresAt`, `usedAt DateTime?`, `createdAt`) per decision 8. Generate + apply a migration.
- [ ] 3.2 New `apps/api/src/email` module wrapping the Resend SDK (`RESEND_API_KEY` via `ConfigService`) — one method, `sendPasswordResetEmail(to, resetUrl)`. `resetUrl` is built from a new `FRONTEND_URL` env var (add to `apps/api/.env`/`.env.example` alongside `CORS_ORIGIN`) + `/reset-password?token=...`. Keep the template minimal (plain text or very simple HTML) — no email-design system needed for a single-recipient transactional email.
- [ ] 3.3 `POST /auth/forgot-password` — `@Public()`, `@Throttle({ default: { limit: 3, ttl: 3_600_000 } })` (decision 7). `ForgotPasswordDto` (`email`). Always returns 200 with an identical generic message regardless of whether the email exists (prevents user enumeration) — internally, if a user is found, generates a token, stores its hash + a short expiry (e.g. 1 hour) in `PasswordResetToken`, and sends the reset email (3.2).
- [ ] 3.4 `POST /auth/reset-password` — `@Public()`. `ResetPasswordDto` (`token`, `newPassword`). Looks up `PasswordResetToken` by hash, rejects (400) if not found/expired/already used, otherwise updates the user's password hash, marks the token `usedAt`, and calls `TokenService.revokeAllForUser` (available since Step 2 — no retrofit needed here, unlike Step 1's change-password).
- [ ] 3.5 Unit tests: `forgotPassword` returns the same response shape whether or not the email exists, and only calls the email-send method when it does; `resetPassword` rejects an expired token, an already-used token, and a wrong token, and accepts a valid one, calling `revokeAllForUser` only on success.
- [ ] 3.6 `apps/web/src/lib/auth-api.ts`: add `forgotPassword(email)` and `resetPassword(token, newPassword)`.
- [ ] 3.7 New `apps/web/src/app/forgot-password/page.tsx` — public, an email-only form calling 3.6's `forgotPassword`; on submit always shows the same generic "if that email exists, a reset link was sent" success message regardless of the API's (also-generic, by design 3.3) response.
- [ ] 3.8 New `apps/web/src/app/reset-password/page.tsx` — public, reads `token` from `useSearchParams()`, a new-password form calling 3.6's `resetPassword`; on success, redirect to `/login` (optionally with a query flag the login page can use to show a "password updated, log in again" message).
- [ ] 3.9 `apps/web/src/app/login/page.tsx`: add a "Forgot password?" link to `/forgot-password` near the password field.
- [ ] 3.10 `apps/web/src/lib/i18n/locales/en.ts` and `es.ts`: add `forgotPassword.*`, `resetPassword.*`, `login.forgotPasswordLink` keys to both files.
- [ ] 3.11 Component tests for the two new forms, following the existing form-test convention — happy path plus at least one error case (expired/invalid reset token) each.
- [ ] 3.12 Manual/live pass against the real Neon dev DB + a real Resend send (to Andrew's own inbox, per decision 2's no-domain-yet caveat): forgot-password with a real email → confirm the email actually arrives → reset via the link → log in with the new password → confirm the pre-reset session's refresh cookie no longer works. Clean up the throwaway user afterward.
- [ ] 3.13 `pnpm --filter api typecheck`/`build`/`test`/`test:e2e`, `pnpm --filter web typecheck`/`build`/`test`, `pnpm lint` all clean.

**Checkpoint 3 (feature complete):** a locked-out user can request a reset email and set a new password through it, which also logs out every other session for that account — completing the full set of decisions above.

## Wrap-up

- [ ] 4.1 Confirm the real Neon dev DB is back to its pre-pass baseline after all four steps — no leftover throwaway users, refresh tokens, or reset tokens from any manual pass above — same cleanup discipline as every prior backlog logged in `CLAUDE.md`.
- [ ] 4.2 One final full-suite regression pass across all four steps together: `pnpm --filter api typecheck`/`build`/`test`/`test:e2e`, `pnpm --filter web typecheck`/`build`/`test`, `pnpm lint`, `pnpm --filter @coin-collector/shared build`.
- [ ] 4.3 Add a dated `CLAUDE.md` changelog entry per step as it ships (matching the format of every prior entry in that file's "Project status" section) — four entries, not one at the very end, since each step is independently shippable (decision 3) and should be logged as it lands.

## Explicitly NOT this scope (resist)

- **A "log out of all devices" / active-sessions UI.** The `familyId`/`userId` revocation machinery Step 2 builds makes it possible, but no page lists a user's sessions or exposes a button for it. Revisit only if it becomes an actual want, not as a freebie bolted onto this pass.
- **Purchasing/wiring up a custom domain for Resend.** Decision 2 already covers this — free-tier sending to Andrew's own inbox is enough while he's the only real user; domain verification is deferred until a second real user needs a reset email.
- **Email verification on signup.** A distinct feature (confirming an email address is real/owned) from password *reset* — not discussed, not in scope here.
- **Password strength rules beyond the existing `@MinLength(8)`.** No complexity/entropy requirements, no breached-password check (e.g. HaveIBeenPwned) — not asked for, adds friction with no scoped payoff yet.
- **Multi-factor authentication.** Out of scope entirely — this backlog is about password recovery and session refresh, not adding a second factor.
- **Moving the access token off `localStorage`.** Decision 5 is explicit that only the refresh token changes storage; the access token's existing bearer/localStorage handling is untouched.
