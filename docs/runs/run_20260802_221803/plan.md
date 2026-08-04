# Technical Plan: JWT refresh tokens (Step 2 of password-management backlog)

**Run:** run_20260802_221803
**Date:** 2026-08-02

## Summary

Replace the API's single fixed 7-day JWT with a rotating pair: a 15-minute access token (unchanged bearer/localStorage handling) plus a 20-day, server-tracked, rotate-on-use refresh token carried in an `httpOnly` cookie. A new `TokenService` owns issuance/rotation/revocation against a new `RefreshToken` Prisma table; `AuthController` gains `POST /auth/refresh` and `POST /auth/logout`; `AuthService.changePassword` (Step 1) is retrofitted to revoke every other session. The frontend's `apiFetch` gains a one-shot silent-refresh-and-retry on a session-invalidating 401, plus `credentials: 'include'` so the cookie actually travels.

## Approach

**Backend — schema & token lifecycle**
- Add a `RefreshToken` model to `apps/api/prisma/schema.prisma` (raw SQL migration hand-written to match this repo's existing Prisma-migration style — no live DB is available to run `prisma migrate dev` from this pipeline, see Risks). Raw tokens are never persisted — only a SHA-256 hex digest (`crypto.createHash('sha256')`), same "never store the raw secret" principle passwords already follow, just without bcrypt's cost factor since these are already-high-entropy random 32-byte tokens, not user-chosen passwords.
- `TokenService` (new) is the only thing that touches the `RefreshToken` table: `issue` (mint), `rotate` (rotate-on-use + family-wide revoke on reuse-detected theft), `revokeAllForUser`, `revokeOne`. `revokeOne`/`revokeAllForUser` use Prisma `updateMany` (not `update`) specifically so revoking an unknown/already-revoked token is a silent no-op rather than a thrown `P2025` — this is what makes `POST /auth/logout` idempotent per PRD criterion 6 without any try/catch in the controller or service.
- `TokenService.rotate` fetches the owning user's `email` in the same query (`include: { user: { select: { email: true } } }`) so `AuthService.refresh` can mint the new access token's JWT payload (`{ sub, email }`) without a second round-trip.

**Backend — cookie plumbing**
- `main.ts`: `cookieParser()` middleware + `credentials: true` on the existing CORS config (the existing `origin` array already filters out an unset `CORS_ORIGIN` via `.filter(Boolean)`, so no wildcard/undefined origin reaches `enableCors` today — no change needed there beyond adding `credentials: true`).
- Cookie name/options live as exported helpers in `token.service.ts` (`REFRESH_TOKEN_COOKIE_NAME`, `refreshTokenCookieOptions()`, `clearedRefreshTokenCookieOptions()`) so `login`/`refresh`/`logout` in the controller all set/clear the exact same cookie shape from one place.

**Backend — endpoints**
- `login` keeps its existing `LoginResponse` (`{ accessToken }`) JSON shape; `AuthService.login`'s return type changes to a new `LoginResult` (`{ accessToken, refreshToken }`) so the controller can pull the raw refresh token out to set as a cookie without it ever reaching the JSON body. `register` is deliberately **not** touched — see Risks.
- `POST /auth/refresh` and `POST /auth/logout` are both `@Public()` (they authenticate via the refresh cookie, not the bearer access token guarded by the global `JwtAuthGuard`) and both read the cookie via `@Req()`. `AuthService.refresh` throws `UnauthorizedException` itself when the cookie is missing, before ever calling `TokenService.rotate` — keeps the "missing vs. invalid vs. reused" distinction entirely in the service layer, matching how `changePassword`'s validation already lives in `AuthService`, not the controller.
- `changePassword` gets one added line: `await this.tokenService.revokeAllForUser(userId)` after the password write succeeds.

**Frontend — apiFetch**
- `fetchWithTimeout` sends `credentials: 'include'` on every call (both the primary attempt and the cold-start retry already in the function).
- `apiFetch`'s existing 401-handling branch (`token && response.status === 401 && !options.skipAuthRedirectOn401`) gets a new condition ANDed in: `path !== '/auth/refresh'`. When all three hold, `apiFetch` makes exactly one internal `POST /auth/refresh` call (own `fetchWithTimeout` invocation, not through `auth-api.ts`, to avoid a circular import between the two modules) and, only if that succeeds, stores the new token (`setStoredToken`) and retries the **original** request once with the new `Authorization` header — whichever response results (the retry's) is what gets returned or turned into an `ApiError`. If the refresh call itself doesn't come back `ok`, or `path === '/auth/refresh'` (this is what stops any recursive refresh attempt on the refresh endpoint's own 401), execution falls through to the existing clear-token-and-redirect behavior unchanged. This preserves every existing `api-client.test.ts` assertion as-is (a single canned mock response for all `fetch` calls in the old tests means the internal refresh attempt "fails" the same way the original request did, so the fallback clear+redirect still fires) — the Tester adds new describe blocks for the success path rather than editing the existing ones.
- `auth-api.ts` gets `refreshAccessToken()` (calls `POST /auth/refresh` with `{ skipAuthRedirectOn401: true }` so this specific call is a pure request/response with no redirect side effect of its own — the redirect-on-failure behavior lives entirely in `apiFetch`'s internal retry path above, not here) and `logout()` (`POST /auth/logout`, awaited, then `clearStoredToken()`).
- `site-nav.tsx`'s `handleLogout` becomes `async`, awaiting the new `logout()` before clearing local state/redirecting. **The existing `site-nav.test.tsx` "logout behaviour" test currently has no fetch mock at all** — since `handleLogout` now makes a real network call via `logout()`, the Tester must add a `vi.stubGlobal('fetch', ...)` stub (204 response) to that specific test, following the same pattern `auth-api.test.ts`/`api-client.test.ts` already use; every other describe block in that file is untouched.

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| `apps/api/prisma/schema.prisma` | MODIFY | Add `RefreshToken` model + `User.refreshTokens` relation |
| `apps/api/prisma/migrations/20260802224500_add_refresh_token/migration.sql` | CREATE | Hand-written migration matching this repo's existing Prisma-migration SQL style |
| `apps/api/package.json` | MODIFY | Add `cookie-parser` (dependency) + `@types/cookie-parser` (devDependency) |
| `apps/api/src/main.ts` | MODIFY | `app.use(cookieParser())`; `credentials: true` on CORS |
| `apps/api/src/auth/token.service.ts` | CREATE | Refresh-token issuance/rotation/revocation + cookie option helpers |
| `apps/api/src/auth/auth.module.ts` | MODIFY | Register `TokenService`; access-token `expiresIn` `7d` → `15m` |
| `apps/api/src/auth/auth.service.ts` | MODIFY | `login` issues a refresh token; new `refresh`/`logout`; `changePassword` revokes all sessions |
| `apps/api/src/auth/auth.controller.ts` | MODIFY | `login` sets the refresh cookie; new `POST /auth/refresh`, `POST /auth/logout` |
| `apps/web/src/lib/api-client.ts` | MODIFY | `credentials: 'include'`; one-shot silent refresh-and-retry on session-invalidating 401 |
| `apps/web/src/lib/auth-api.ts` | MODIFY | Add `refreshAccessToken()`, `logout()` |
| `apps/web/src/components/layout/site-nav.tsx` | MODIFY | `handleLogout` becomes `async`, calls `logout()` |

## Interface Contract

This section is the single source of truth for all names. The Tester and Coder read this; neither invents anything independently.

### Module: `apps/api/prisma/schema.prisma` (MODIFY)
Add, alongside the existing models:
```prisma
model User {
  // ...existing fields/relations unchanged...
  refreshTokens RefreshToken[]
}

model RefreshToken {
  id        String    @id @default(uuid())
  userId    String
  tokenHash String    @unique
  expiresAt DateTime
  revokedAt DateTime?
  familyId  String
  createdAt DateTime  @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([familyId])
}
```

### File: `apps/api/prisma/migrations/20260802224500_add_refresh_token/migration.sql` (CREATE)
```sql
-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "familyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_familyId_idx" ON "RefreshToken"("familyId");

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
```
No test coverage of this file directly (schema/migration files aren't unit-testable) — its correctness is exercised indirectly by `token.service.spec.ts`'s mocked-Prisma assertions and by `auth-refresh.e2e-spec.ts` against a real DB (not run by this pipeline's sandbox — see repo-digest.md's Test command note; validated by CI/manual pass instead).

### Module: `apps/api/package.json` (MODIFY)
Add to `dependencies`: `"cookie-parser": "^1.4.7"`. Add to `devDependencies`: `"@types/cookie-parser": "^1.4.9"`.

### Module: `apps/api/src/main.ts` (MODIFY)
```typescript
import cookieParser from 'cookie-parser';
// ...
app.use(cookieParser());
app.enableCors({
  origin: [process.env.CORS_ORIGIN, 'http://localhost:3000'].filter(Boolean),
  credentials: true,
});
```
No test coverage (bootstrap file, not imported by any spec in this repo today).

### Module: `apps/api/src/auth/token.service.ts` (CREATE)
- **File:** `apps/api/src/auth/token.service.ts`
- **Exports:**
  ```typescript
  export const REFRESH_TOKEN_COOKIE_NAME = 'refreshToken';

  export interface IssuedRefreshToken {
    rawToken: string;
    familyId: string;
    expiresAt: Date;
  }

  export function refreshTokenCookieOptions(): {
    httpOnly: true; secure: true; sameSite: 'lax'; path: '/'; maxAge: number;
  };

  export function clearedRefreshTokenCookieOptions(): {
    httpOnly: true; secure: true; sameSite: 'lax'; path: '/';
  };

  export class TokenService {
    issue(userId: string, familyId?: string): Promise<IssuedRefreshToken>;
    rotate(rawToken: string): Promise<{ userId: string; email: string } & IssuedRefreshToken>;
    revokeAllForUser(userId: string): Promise<void>;
    revokeOne(rawToken: string): Promise<void>;
  }
  ```
- **Behavior contract (exact — Tester writes assertions against this):**
  - `issue(userId, familyId?)`: generates `rawToken = crypto.randomBytes(32).toString('hex')`; `familyId` defaults to `crypto.randomUUID()` when omitted; `expiresAt = now + 20 days`; creates one `RefreshToken` row via `prisma.refreshToken.create` with `tokenHash = sha256(rawToken)`; returns `{ rawToken, familyId, expiresAt }`.
  - `rotate(rawToken)`: looks up by `tokenHash` via `prisma.refreshToken.findUnique` (with `include: { user: { select: { email: true } } }`). Throws `UnauthorizedException` if not found or `expiresAt` is in the past. If `revokedAt` is already set (reuse of an already-rotated-out token): revokes **every** row sharing that `familyId` via one `updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } })`, then throws `UnauthorizedException`. Otherwise: revokes the found row (`update`, single row by `id`), calls `issue(existing.userId, existing.familyId)` to mint the replacement in the same family, and returns `{ userId, email, ...issued }`.
  - `revokeAllForUser(userId)`: `prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } })`. Never throws even if the user has zero active tokens.
  - `revokeOne(rawToken)`: `prisma.refreshToken.updateMany({ where: { tokenHash: sha256(rawToken), revokedAt: null }, data: { revokedAt: new Date() } })`. Never throws — an unknown/already-revoked token is a silent no-op (this is what makes `POST /auth/logout` idempotent).
- **Dependencies:** `PrismaService` (constructor-injected, mock in unit tests the same way `auth.service.spec.ts` mocks it).

### Module: `apps/api/src/auth/auth.module.ts` (MODIFY)
- `providers: [AuthService, JwtStrategy, TokenService]` (add `TokenService`).
- `JwtModule.registerAsync(...).useFactory(...).signOptions.expiresIn`: `'7d'` → `'15m'`.
- No test coverage (module wiring file, not imported by any spec in this repo today).

### Module: `apps/api/src/auth/auth.service.ts` (MODIFY)
- **File:** `apps/api/src/auth/auth.service.ts`
- **New/changed exports:**
  ```typescript
  export interface LoginResponse {
    accessToken: string;
  }

  export interface LoginResult extends LoginResponse {
    refreshToken: string;
  }

  export class AuthService {
    constructor(prisma: PrismaService, jwtService: JwtService, tokenService: TokenService);
    login(dto: LoginDto): Promise<LoginResult>; // return type changed from LoginResponse
    refresh(rawRefreshToken?: string): Promise<LoginResult>;
    logout(rawRefreshToken?: string): Promise<void>;
    changePassword(userId: string, dto: ChangePasswordDto): Promise<void>; // unchanged signature
  }
  ```
- **Behavior contract:**
  - `login(dto)`: unchanged credential check; on success also calls `tokenService.issue(user.id)` and returns `{ accessToken, refreshToken: rawToken }`.
  - `refresh(rawRefreshToken)`: throws `UnauthorizedException('No refresh token cookie')` immediately if `rawRefreshToken` is falsy (this is the "missing cookie → 401" case — checked here, not in the controller). Otherwise calls `tokenService.rotate(rawRefreshToken)` (which itself throws `UnauthorizedException` on invalid/expired/reused — that exception propagates unchanged) and returns `{ accessToken: await jwtService.signAsync({ sub: userId, email }), refreshToken: rawToken }` from the rotation result.
  - `logout(rawRefreshToken)`: if `rawRefreshToken` is present, calls `tokenService.revokeOne(rawRefreshToken)`; otherwise no-op. Never throws.
  - `changePassword(userId, dto)`: unchanged existing logic, with `await this.tokenService.revokeAllForUser(userId)` added as the last line on the success path (after the password `update`, not before).
- **Dependencies:** adds `TokenService` to the constructor (mock it the same `useValue` way `auth.service.spec.ts` already mocks `PrismaService`/`JwtService`).

### Module: `apps/api/src/auth/auth.controller.ts` (MODIFY)
- **File:** `apps/api/src/auth/auth.controller.ts`
- **Changed/new handlers:**
  ```typescript
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response): Promise<LoginResponse>;

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<LoginResponse>;

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void>;
  ```
- **Behavior contract:**
  - `login`: calls `authService.login(dto)`, sets `res.cookie(REFRESH_TOKEN_COOKIE_NAME, refreshToken, refreshTokenCookieOptions())`, returns `{ accessToken }` only (never the raw refresh token in the JSON body).
  - `refresh`: reads `req.cookies?.[REFRESH_TOKEN_COOKIE_NAME]`, calls `authService.refresh(that value)`, sets the rotated cookie the same way as `login`, returns `{ accessToken }`.
  - `logout`: reads `req.cookies?.[REFRESH_TOKEN_COOKIE_NAME]`, calls `authService.logout(that value)`, then unconditionally `res.clearCookie(REFRESH_TOKEN_COOKIE_NAME, clearedRefreshTokenCookieOptions())`.
  - `register` is **unchanged** — no `@Res()`, no token issuance. See Risks for why.
- **`@Public()` metadata — note for Tester:** `refresh` and `logout` must assert `IS_PUBLIC_KEY` is **truthy** (inverse of the existing `me`/`changePassword` "does NOT mark as public" pattern) — they bypass the global `JwtAuthGuard` by design, authenticating via the refresh cookie instead.
- **Test focus for Tester:** unit tests mock `AuthService` entirely (existing convention) and must pass a mock `res` object (`{ cookie: jest.fn(), clearCookie: jest.fn() }`) to assert the correct cookie name/value/options are set/cleared, plus a mock `req` object (`{ cookies: { refreshToken: '...' } }` or `{ cookies: {} }`) for `refresh`/`logout`.

### Module: `apps/web/src/lib/api-client.ts` (MODIFY, existing file)
- **File:** `apps/web/src/lib/api-client.ts`
- **Exports:** `apiFetch`, `ApiError` — unchanged signatures.
- **Behavior contract (new, additive to existing documented behavior in `api-client.test.ts`):**
  - Every `fetchWithTimeout` call (the primary attempt and its own existing cold-start retry) includes `credentials: 'include'`.
  - On a response where `token && response.status === 401 && !options.skipAuthRedirectOn401 && path !== '/auth/refresh'`: make exactly one `POST` to `${API_BASE_URL}/auth/refresh` with `credentials: 'include'` (a second, independent `fetchWithTimeout` call — not routed through `auth-api.ts`). If that call is `ok`: parse `{ accessToken }`, call `setStoredToken(accessToken)`, then retry the **original** request once with a rebuilt `Authorization: Bearer <new token>` header; the retry's response (success or error) is what `apiFetch` ultimately returns/throws. If the refresh call is not `ok`: fall through to the existing clear-token-and-redirect behavior, building the thrown `ApiError` from the **original** 401 response.
  - When `path === '/auth/refresh'` itself 401s (or when `skipAuthRedirectOn401`/no-token conditions apply), behavior is exactly what exists today — this is what the byte-identical existing tests in `api-client.test.ts` continue to verify.
- **Call-order contract for deterministic test mocks:** original request → (if session-invalidating 401) refresh call → (if refresh succeeded) retried original request. Exactly one retry, never recursive.

### Module: `apps/web/src/lib/auth-api.ts` (MODIFY, existing file)
- **File:** `apps/web/src/lib/auth-api.ts`
- **New exports:**
  ```typescript
  export async function refreshAccessToken(): Promise<AuthResponse>;
  export async function logout(): Promise<void>;
  ```
- **Behavior contract:**
  - `refreshAccessToken()`: `apiFetch<AuthResponse>('/auth/refresh', { method: 'POST' }, { skipAuthRedirectOn401: true })`, then `setStoredToken(response.accessToken)`, returns the response.
  - `logout()`: `await apiFetch<void>('/auth/logout', { method: 'POST' }, { skipAuthRedirectOn401: true })`, then `clearStoredToken()` — awaited, not fire-and-forget, so the server-side revocation completes before local state clears.

### Module: `apps/web/src/components/layout/site-nav.tsx` (MODIFY, existing file)
- **File:** `apps/web/src/components/layout/site-nav.tsx`
- **Changed:** `handleLogout` becomes `async function handleLogout()`, body becomes `await logout(); setIsAuthenticated(false); router.push('/login');` (import `logout` from `@/lib/auth-api`, alongside the existing `clearStoredToken`/`getStoredToken` import from `@/lib/auth-token` — `clearStoredToken` is no longer called directly here since `logout()` now does that itself).
- **No new `data-testid`s.** `AccountMenu`'s `onLogout: () => void` prop type is unaffected (a `() => Promise<void>` is structurally assignable) — `account-menu.tsx` is not modified.
- **Existing test requiring an update (not carried byte-identical):** `site-nav.test.tsx`'s "logout behaviour" describe block currently has no `fetch` mock. It must add `vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => undefined }))` (and `vi.unstubAllGlobals()` cleanup) before clicking the logout button, following the same stub pattern already used in `auth-api.test.ts`/`api-client.test.ts`. Every other describe block in the file is untouched.

## Pre-existing testids (declared for contract-check purposes only)

`site-nav.test.tsx` is carried over almost entirely byte-identical from prior runs (only its "logout behaviour" block changes — see `site-nav.tsx`'s Interface Contract section above). None of the testids below are new or modified by this run; they are restated here only because `check-contract.sh`'s mechanical `TESTID_NOT_IN_CONTRACT` check reads exclusively THIS run's `plan.md`, with no memory of the prior runs' contracts that actually declared them (a known, documented gotcha for this repo).

- `data-testid="language-switcher"`
- `data-testid="language-switcher-select"`
- `data-testid="site-nav"`
- `data-testid="site-nav-account-menu"`
- `data-testid="site-nav-account-trigger"`
- `data-testid="site-nav-brand"`
- `data-testid="site-nav-catalog-link"`
- `data-testid="site-nav-collection-link"`
- `data-testid="site-nav-dashboard-link"`
- `data-testid="site-nav-glossary-link"`
- `data-testid="site-nav-login-link"`
- `data-testid="site-nav-logout"`
- `data-testid="site-nav-my-submissions-link"`
- `data-testid="site-nav-sets-link"`
- `data-testid="site-nav-settings-link"`
- `data-testid="site-nav-signup-link"`

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. `RefreshToken` model + migration | `schema.prisma`, `migrations/20260802224500_add_refresh_token/migration.sql` |
| 2. `cookie-parser` wired, CORS `credentials: true` | `main.ts` |
| 3. `TokenService`: issue/rotate/revokeAllForUser/revokeOne | `token.service.ts` |
| 4. Access token `15m`; login sets refresh cookie, JSON body unchanged | `auth.module.ts`, `auth.service.ts` (`login`), `auth.controller.ts` (`login`) |
| 5. `POST /auth/refresh` | `auth.controller.ts` (`refresh`), `auth.service.ts` (`refresh`) |
| 6. `POST /auth/logout`, idempotent | `auth.controller.ts` (`logout`), `auth.service.ts` (`logout`), `token.service.ts` (`revokeOne` via `updateMany`) |
| 7. `changePassword` revokes all sessions | `auth.service.ts` (`changePassword`) |
| 8. Unit tests: rotate happy path, rotate reuse-detection, changePassword revocation | `token.service.spec.ts` (new), `auth.service.spec.ts` (extended) |
| 9. `auth-refresh.e2e-spec.ts` | new file (not run by sandbox — CI/manual, see repo-digest.md) |
| 10. `credentials: 'include'`, silent refresh-and-retry on 401 | `api-client.ts` |
| 11. `refreshAccessToken()`, `logout()` | `auth-api.ts` |
| 12. `handleLogout` async, awaits `logout()` | `site-nav.tsx` |
| 13. typecheck/build/test/test:e2e/lint clean | all files above; `test:e2e` validated outside this pipeline's sandbox (see Risks) |

## Risks and open questions

- **`register` deliberately does not issue a refresh token or cookie**, despite the backlog's decision 9 phrasing ("`AuthController.login`/`register` take `@Res({ passthrough: true })`"). The frontend's `auth-api.ts` `register()` always immediately chains into `login()` with the same credentials (existing behavior, unchanged) — that `login()` call's `Set-Cookie` is what actually establishes the session either way. Having `register` also mint a refresh token would create one permanently-orphaned, never-revoked `RefreshToken` row per signup for zero observable behavior change. Flagging this explicitly rather than silently deviating from the backlog text — if the user wants `register` to also set a cookie (e.g. for a future flow that doesn't immediately call `login`), that's a small, isolated follow-up.
- **The sandbox test command (see updated `repo-digest.md`) excludes `pnpm --filter api test:e2e`.** The sandbox worktree has no reachable Postgres and no copied `.env` (gitignored), so neither the new `auth-refresh.e2e-spec.ts` nor the pre-existing `auth.e2e-spec.ts` can run there. Both are still written and will run in CI (`.github/workflows/ci.yml` already provisions a real `postgres:16-alpine` service) and in the PRD's out-of-scope-flagged manual live pass — just not verified by this pipeline's Stage 6.
- **Migration file is hand-written, not generated by a live `prisma migrate dev`.** It matches this repo's existing migration SQL style exactly (verified against all 4 prior migration files), but applying it against the real Neon dev DB (part of backlog task 2.1) is a live-infra action outside this pipeline's automated reach — same class of limitation as the manual pass in task 2.13.
- **Cookie `secure: true` requires HTTPS.** Local `http://localhost` development already works today per this pattern in most browsers only when `SameSite=Lax` (not `None`), which is what's specified — no `--insecure` workaround needed, but worth the Coder double-checking against the actual local dev setup during any manual verification.
