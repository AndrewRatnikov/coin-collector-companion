# Technical Plan: Change password (Step 1 of Password Management)

**Run:** run_20260802_183303
**Date:** 2026-08-02

## Summary

Adds a guarded `PATCH /auth/password` endpoint to the existing `apps/api/src/auth` module (new `ChangePasswordDto`, a new `AuthService.changePassword` method, a new controller handler) and a change-password form on the `/settings` page `apps/web` already has from Step 0, positioned below the existing read-only account-info block. A necessary, narrowly-scoped fix to `apiFetch` is included: today it treats *any* 401 received while a token is attached as "session expired" and force-clears the token + redirects to `/login`, which would incorrectly log a user out just for mistyping their current password. Every other piece follows an existing sibling pattern already in the repo (`login`/`signup`'s form + `ApiError`/`fieldErrorsFrom` handling, `AuthService.register`'s bcrypt hashing convention) rather than inventing new ones.

## Approach

**Backend (`apps/api`):**
- New `ChangePasswordDto` (`currentPassword: string`, `newPassword: string` with `@MinLength(8)`, matching `RegisterDto`'s `@ApiProperty`/`class-validator` style).
- `AuthService` (MODIFY) gets `changePassword(userId, dto): Promise<void>`: looks up the full user row (needs `passwordHash`, so no restrictive `select` this time — contrast with `me()`'s `select`-based omission), `bcrypt.compare`s `dto.currentPassword` against it, throws `UnauthorizedException('Current password is incorrect')` on mismatch (no write happens on this path), otherwise `bcrypt.hash`es `dto.newPassword` (same `BCRYPT_COST` constant `register()` already uses) and persists it via `prisma.user.update`.
- `AuthController` (MODIFY) gets `PATCH /auth/password`, **not** `@Public()` (guarded by the global `JwtAuthGuard`, same convention as `me`), returning `204 No Content` on success (`@HttpCode(HttpStatus.NO_CONTENT)`) — there's no resource to return, and 204 lets the frontend's existing `apiFetch` no-body-parse branch (`response.status === 204 → return undefined`) handle it for free without needing a placeholder JSON body.
- `auth.controller.spec.ts`/`auth.service.spec.ts` (MODIFY, both already exist from Step 0) get new `describe` blocks for `changePassword` — existing `me`-only blocks are untouched. `auth.service.spec.ts` adds a file-level `jest.mock('bcrypt')` (not needed by the existing `me` tests, which never call bcrypt, so this addition is safe) to control `bcrypt.compare`/`bcrypt.hash` deterministically without a real hash computation.

**Frontend (`apps/web`):**
- **`api-client.ts` (MODIFY) — the one non-additive change this plan makes to an existing contract:** `apiFetch<T>(path, init, options)` gains a third, optional parameter `{ skipAuthRedirectOn401?: boolean }` (default `{}` → behavior unchanged for every existing call site). The 401-handling block becomes `if (token && response.status === 401 && !options.skipAuthRedirectOn401)`. This is necessary because `PATCH /auth/password` can legitimately return 401 for "wrong current password" while the session itself is still valid — the existing blanket rule (401 + token attached ⇒ session invalidated, clear + redirect) is correct for every other guarded endpoint in this app but wrong specifically here, and would otherwise silently log the user out and redirect away from `/settings` on a simple typo, contradicting PRD criterion #7 (inline error, no reload/redirect). All four existing `api-client.test.ts` assertions are unaffected (they don't pass a third argument); two new tests cover the opt-out path and a regression guard that the default (no opt-out) still redirects.
- `auth-api.ts` (MODIFY): add `changePassword(currentPassword, newPassword): Promise<void>` calling `apiFetch<void>('/auth/password', { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) }, { skipAuthRedirectOn401: true })`.
- `settings/page.tsx` (MODIFY): add a new `ChangePasswordForm` component, rendered unconditionally inside `SettingsContent`'s `<main>`, positioned after the existing `data && (...)` account-info block. It owns its own local state (`currentPassword`, `newPassword`, `fieldErrors`, `formError`, `successMessage`) and `handleSubmit`, following `login/page.tsx`'s exact `ApiError`/`fieldErrorsFrom` branching (400 → per-field errors via `FormField`'s built-in `error` prop; any other `ApiError` status, incl. 401 → single form-level message via `error.details.join(', ')`; non-`ApiError` → a canned `settings.changePasswordError` message). On success, clears both fields and shows a canned `settings.changePasswordSuccess` message.
- `en.ts`/`es.ts` (MODIFY): add 6 new `settings.*` keys (title, two field labels, submit button, success message, generic error message) to both dictionaries in the same pass — `dictionaries.test.ts`'s existing key-parity check plus `es.ts`'s `Record<MessageKey, string>` compile-time check both fail on a one-sided addition, so this must land together (established convention, unchanged).
- `settings/page.test.tsx` (MODIFY, already exists from Step 0): new `describe` blocks for the change-password form's happy path and the wrong-current-password 401 case (asserting the error renders inline **and** that no `/login` redirect happens) — existing account-info/auth-gating blocks are untouched.
- `auth-api.test.ts` / `api-client.test.ts` (MODIFY, both already exist): new coverage for `changePassword`'s request shape and the `skipAuthRedirectOn401` opt-out, respectively — existing blocks untouched.

**Edge cases handled:**
- Wrong current password: 401, no DB write (`prisma.user.update` never called — verified in `auth.service.spec.ts`), and the frontend shows an inline error without clearing the session or navigating away (the `skipAuthRedirectOn401` fix above).
- 400 validation errors (e.g. `newPassword` under 8 characters): routed to per-field errors via the existing `fieldErrorsFrom` convention, identical to `login`/`signup`.
- Successful change: old password stops working, new one works — this specific runtime behavior is only provable against the real Neon dev DB (bcrypt hash actually persisted and later compared), so it is **out of scope for the automated Coder/sandbox stages** per the PRD; PRD acceptance criterion coverage below marks it as a documented manual follow-up (backlog task 1.7), consistent with this repo's established convention for live-DB-only verification (memory.md).

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| apps/api/src/auth/dto/change-password.dto.ts | CREATE | `ChangePasswordDto` (currentPassword, newPassword) |
| apps/api/src/auth/auth.service.ts | MODIFY | Add `AuthService.changePassword(userId, dto)` |
| apps/api/src/auth/auth.controller.ts | MODIFY | Add guarded `PATCH /auth/password` handler |
| apps/api/src/auth/auth.controller.spec.ts | MODIFY | Add `changePassword` delegation + guard-metadata tests |
| apps/api/src/auth/auth.service.spec.ts | MODIFY | Add `changePassword` bcrypt-mocked unit tests |
| apps/web/src/lib/api-client.ts | MODIFY | Add `skipAuthRedirectOn401` opt-out to `apiFetch` |
| apps/web/src/lib/api-client.test.ts | MODIFY | Add opt-out + regression-guard tests |
| apps/web/src/lib/auth-api.ts | MODIFY | Add `changePassword(currentPassword, newPassword)` |
| apps/web/src/lib/auth-api.test.ts | MODIFY | Add tests for `changePassword()` |
| apps/web/src/app/settings/page.tsx | MODIFY | Add `ChangePasswordForm` below account-info block |
| apps/web/src/app/settings/page.test.tsx | MODIFY | Add happy-path + wrong-password-error tests |
| apps/web/src/lib/i18n/locales/en.ts | MODIFY | Add 6 `settings.changePassword*`/label keys |
| apps/web/src/lib/i18n/locales/es.ts | MODIFY | Add the same 6 keys (Spanish) |

## Interface Contract

This section is the single source of truth for all names. The Tester and Coder read this; neither invents anything independently.

### Backend

#### DTO: `ChangePasswordDto` (CREATE) — `apps/api/src/auth/dto/change-password.dto.ts`
```typescript
import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty()
  @IsString()
  currentPassword!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
```

#### Service: `AuthService` (MODIFY) — `apps/api/src/auth/auth.service.ts`
- **New method:** `changePassword(userId: string, dto: ChangePasswordDto): Promise<void>`
  - Implementation:
    ```typescript
    async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
      const isCurrentPasswordValid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
      if (!isCurrentPasswordValid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
      const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_COST);
      await this.prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    }
    ```
  - No `select` on the `findUniqueOrThrow` call — the full row (including `passwordHash`) is needed internally; nothing from `user` is ever returned by this method (`Promise<void>`), so there's no leak risk analogous to `me()`'s.
  - Import addition: `ChangePasswordDto` from `./dto/change-password.dto`. `UnauthorizedException` is already imported (used by `login`).

#### Controller: `AuthController` (MODIFY) — `apps/api/src/auth/auth.controller.ts`
- **New handler:** `changePassword(@CurrentUser() user: AuthenticatedUser, @Body() dto: ChangePasswordDto): Promise<void>`
  - Route: `@Patch('password')`
  - **No `@Public()` decorator** — guarded by the global `JwtAuthGuard`, same convention as `me`.
  - `@HttpCode(HttpStatus.NO_CONTENT)` — 204, no response body.
  - Body: `return this.authService.changePassword(user.userId, dto);`
  - Swagger decorators for consistency: `@ApiOperation({ summary: "Change the current user's password" })`, `@ApiNoContentResponse({ description: 'Password changed' })`, `@ApiUnauthorizedResponse({ description: 'Current password is incorrect, or no/invalid access token' })`.
  - Import additions: `Patch` (from `@nestjs/common`, alongside the existing `Body, Controller, Get, HttpCode, HttpStatus, Post`), `ApiNoContentResponse` (from `@nestjs/swagger`), `ChangePasswordDto` (from `./dto/change-password.dto`).
- **Resulting route:** `PATCH /api/v1/auth/password` (global prefix `api/v1` per `main.ts`) — guarded, 401 if no/invalid bearer token OR if `currentPassword` doesn't match, 400 if `newPassword` fails `@MinLength(8)`, 204 on success.

### Frontend

#### Module: `api-client` (MODIFY) — `apps/web/src/lib/api-client.ts`
- **Modified signature:** `apiFetch<T>(path: string, init: RequestInit = {}, options: { skipAuthRedirectOn401?: boolean } = {}): Promise<T>`
- **Modified 401 branch:**
  ```typescript
  if (token && response.status === 401 && !options.skipAuthRedirectOn401) {
    clearStoredToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
  ```
  Everything else in `apiFetch` (Bearer header attachment, cold-start retry, non-401 error handling, 204/JSON response parsing) is untouched.

#### Module: `auth-api` (MODIFY) — `apps/web/src/lib/auth-api.ts`
- **New export:** `async function changePassword(currentPassword: string, newPassword: string): Promise<void>`
  - Implementation:
    ```typescript
    export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
      return apiFetch<void>(
        '/auth/password',
        { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) },
        { skipAuthRedirectOn401: true },
      );
    }
    ```

#### Component: `ChangePasswordForm` (CREATE, inline in `settings/page.tsx`, not separately exported) — `apps/web/src/app/settings/page.tsx`
- Rendered unconditionally inside `SettingsContent`, immediately after the existing `data && (<div data-testid="settings-account-info">...)` block, still inside the same `<main data-testid="settings-page">`.
- **Local state:** `currentPassword: string`, `newPassword: string`, `fieldErrors: Record<string, string>`, `formError: string`, `successMessage: string`.
- **`CHANGE_PASSWORD_FIELDS = ['currentPassword', 'newPassword']`** (module-level const, mirrors `login/page.tsx`'s `FIELDS`).
- **`handleSubmit`** (mirrors `login/page.tsx`'s `handleSubmit` exactly, swapping `login(...)` for `changePassword(currentPassword, newPassword)`):
  - Clears `fieldErrors`/`formError`/`successMessage` at the start.
  - On success: sets `successMessage = t('settings.changePasswordSuccess')`, clears both password fields.
  - On `ApiError` with `status === 400`: `fieldErrors = fieldErrorsFrom(error.details, CHANGE_PASSWORD_FIELDS)`; any unmatched detail lines join into `formError`.
  - On any other `ApiError` (incl. 401 wrong-current-password): `formError = error.details.join(', ')`.
  - On a non-`ApiError` exception: `formError = t('settings.changePasswordError')`.
- **JSX structure:**
  ```tsx
  <form data-testid="settings-change-password-form" onSubmit={handleSubmit} className="...">
    <h2>{t('settings.changePasswordTitle')}</h2>
    <FormField id="currentPassword" label={t('settings.currentPasswordLabel')} type="password"
      autoComplete="current-password" value={currentPassword} onChange={setCurrentPassword}
      error={fieldErrors.currentPassword} />
    <FormField id="newPassword" label={t('settings.newPasswordLabel')} type="password"
      autoComplete="new-password" value={newPassword} onChange={setNewPassword}
      error={fieldErrors.newPassword} />
    {formError && <p data-testid="settings-change-password-error">{formError}</p>}
    {successMessage && <p data-testid="settings-change-password-success">{successMessage}</p>}
    <button type="submit" data-testid="settings-change-password-submit">
      {t('settings.changePasswordSubmit')}
    </button>
  </form>
  ```
- **Test selectors:**
  - `data-testid="settings-change-password-form"` — the form root
  - `document.getElementById('currentPassword')` / `document.getElementById('newPassword')` — the two password inputs (no dedicated testid, same convention as `login`/`signup`'s `FormField` usage)
  - `document.getElementById('currentPassword-error')` / `document.getElementById('newPassword-error')` — per-field errors (built into `FormField`, existing behavior, not new)
  - `data-testid="settings-change-password-error"` — form-level error message
  - `data-testid="settings-change-password-success"` — success message
  - `data-testid="settings-change-password-submit"` — submit button
- **Dependencies:** `@/components/auth/form-field` (`FormField`, existing), `@/lib/auth-api` (`changePassword`, new), `@/lib/api-client` (`ApiError`, existing), `@/lib/form-errors` (`fieldErrorsFrom`, existing), `@/lib/i18n/i18n-context` (`useTranslation`, existing), React's `useState`/`FormEvent` (new imports to this file — `settings/page.tsx` currently has no local state or form).

### i18n keys (add to both `en.ts` and `es.ts`)

| Key | en | es |
|-----|----|----|
| `settings.changePasswordTitle` | `Change password` | `Cambiar contraseña` |
| `settings.currentPasswordLabel` | `Current password` | `Contraseña actual` |
| `settings.newPasswordLabel` | `New password` | `Nueva contraseña` |
| `settings.changePasswordSubmit` | `Change password` | `Cambiar contraseña` |
| `settings.changePasswordSuccess` | `Password changed successfully.` | `Contraseña actualizada correctamente.` |
| `settings.changePasswordError` | `Something went wrong changing your password. Please try again.` | `Ocurrió un error al cambiar tu contraseña. Inténtalo de nuevo.` |

### Pre-existing testids (declared for contract-check purposes only)

Referenced by this run's tests but defined in files this plan does not modify:
- `data-testid="settings-page"` — existing, `settings/page.tsx` (Step 0)
- `data-testid="settings-loading"` — existing, `settings/page.tsx` (Step 0)
- `data-testid="settings-error"` — existing, `settings/page.tsx` (Step 0)
- `data-testid="settings-account-info"` — existing, `settings/page.tsx` (Step 0)
- `data-testid="settings-email"` — existing, `settings/page.tsx` (Step 0)
- `data-testid="settings-member-since"` — existing, `settings/page.tsx` (Step 0)

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. `PATCH /auth/password` guarded, `ChangePasswordDto` with `@MinLength(8)` | `change-password.dto.ts` CREATE, `auth.controller.ts` MODIFY |
| 2. Verifies `currentPassword` via `bcrypt.compare`, 401 + no write on mismatch | `AuthService.changePassword` |
| 3. Correct call hashes and persists the new password | `AuthService.changePassword`'s `bcrypt.hash` + `prisma.user.update` |
| 4. Unit tests: wrong password → 401 + no write; correct call hashes/persists | `auth.service.spec.ts`, `auth.controller.spec.ts` MODIFY |
| 5. `changePassword()` in `auth-api.ts` | `auth-api.ts` MODIFY |
| 6. Change-password form added to `/settings` below account-info block | `settings/page.tsx`'s `ChangePasswordForm` |
| 7. Success/error messages shown inline, no reload | `ChangePasswordForm`'s `successMessage`/`formError` state + `skipAuthRedirectOn401` fix (prevents an incorrect logout-and-redirect on the 401 wrong-password case) |
| 8. New i18n keys in both `en.ts`/`es.ts` | i18n MODIFY, 6-key table above |
| 9. Component test: happy path + wrong-password error | `settings/page.test.tsx` MODIFY |
| 10. `typecheck`/`build`/`test`/`lint` all clean | Verified in Stage 6 sandbox (`pnpm --filter api`/`pnpm --filter web` `test`; `typecheck`/`build`/`lint` are documented as a manual follow-up alongside criterion coverage below — see Risks) |

## Risks and open questions

- **`apiFetch`'s `skipAuthRedirectOn401` is a real, load-bearing behavior change**, not a cosmetic addition — without it, criterion #7 is unsatisfiable (a wrong current password would force-logout the user instead of showing an inline error). Scoped as narrowly as possible: default `false`, only `changePassword` opts in, all four pre-existing `api-client.test.ts` assertions are expected to still pass unmodified.
- **`findUniqueOrThrow` on a deleted user** (same risk `me()` already carries, documented in Step 0's plan): if a user record were deleted mid-session, `changePassword` would throw a Prisma `NotFoundError` → Nest's default 500, not a clean 401/404. Out of scope per the PRD (no account-deletion feature exists), left as default exception-filter behavior, consistent with `me()`'s precedent.
- **Backlog task 1.7 (manual live-DB pass: change password, log out, confirm old password fails / new one works)** cannot be executed by the automated Coder/sandbox stages, which have no real DB credentials — per PRD "Out of scope" and this repo's established convention (memory.md: live-DB verification is a documented manual follow-up, not something the pipeline marks done on its own). This run will flag it as pending in the hand-off summary rather than silently omitting it.
- **`pnpm lint`/`typecheck`/`build`** are not part of Stage 6's sandbox `Test command` (which runs `pnpm --filter api test` / `pnpm --filter web test` only, per `repo-digest.md`, following this repo's established sandbox convention) — criterion #10's `test` half is verified by the sandbox; the `typecheck`/`build`/`lint` half is the same class of manual follow-up as every prior run against this repo, not a gap specific to this task.
- **No cross-session revocation on this change** (decision 6 / PRD "Out of scope") is intentional per the backlog's documented build order — Step 2 retrofits it (task 2.7), not something to add here even though it would be straightforward to bolt on.
