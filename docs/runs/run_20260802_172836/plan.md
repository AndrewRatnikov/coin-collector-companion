# Technical Plan: Settings page scaffold + account info (Step 0 of Password Management)

**Run:** run_20260802_172836
**Date:** 2026-08-02

## Summary

Adds a guarded `GET /auth/me` endpoint to the existing `apps/api/src/auth` module, a `getCurrentUser()` client function backed by a new `useCurrentUser()` query hook, and a new `RequireAuth`-wrapped `/settings` page in `apps/web` that renders the account's email and join date. A nav link to `/settings` is added inside the existing `AccountMenu` authenticated-link group. This is a read-only scaffold — no password-change functionality is added (that's Step 1). Every piece follows an existing sibling pattern already in the repo (Dashboard/Collection pages, `use-collection.ts`/`use-user-sets.ts` hooks, `CatalogService`'s field-omission-via-`select` convention) rather than inventing new ones.

## Approach

**Backend (`apps/api`):**
- `AuthService` (MODIFY) gets a new `me(userId: string): Promise<RegisteredUser>` method, sitting alongside the existing `register`/`login`. It calls `this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, createdAt: true } })` — the same `select` shape `register()` already uses, so `passwordHash` is excluded at the query level, not just by the controller/DTO (defense-in-depth, matching `CatalogService`'s `submittedByUserId` omission the backlog calls out). No new interface: the return type is the existing `RegisteredUser`.
- `AuthController` (MODIFY) gets a new `GET /auth/me` handler. No `@Public()` decorator — the app's global `JwtAuthGuard` (registered via `APP_GUARD` in `app.module.ts`) guards it by default, same as `CatalogController.create`. It reads the caller via the existing `@CurrentUser()` decorator (`AuthenticatedUser.userId`) and delegates to `authService.me(user.userId)`.
- Two new spec files (`auth.controller.spec.ts`, `auth.service.spec.ts`) — this module has no existing spec files, so both are created from scratch, following `catalog.controller.spec.ts`/`catalog.service.spec.ts`'s mocked-service/mocked-Prisma conventions exactly (`Test.createTestingModule` + `useValue` mocks, `Reflector` for guard-metadata assertions, no real DB/network call).

**Frontend (`apps/web`):**
- `auth-api.ts` (MODIFY): add a `CurrentUser` interface (`{ id: string; email: string; createdAt: string }` — `createdAt` is a string here, same as the inline type `register()` already uses for its own `/auth/register` response, since dates serialize to ISO strings over JSON) and a `getCurrentUser()` function calling `apiFetch<CurrentUser>('/auth/me')` (GET is `apiFetch`'s default method, same as every other read call in this file's siblings).
- New `apps/web/src/lib/hooks/use-current-user.ts` (CREATE): a `useCurrentUser()` hook wrapping `useQuery({ queryKey: ['auth', 'me'], queryFn: getCurrentUser })`, mirroring `useCollection`/`useUserSets`'s shape in `use-collection.ts`/`use-user-sets.ts`. This keeps the settings page consistent with every other `RequireAuth`-wrapped page in the app, which all fetch through a dedicated hook rather than calling `useQuery` inline.
- New `apps/web/src/app/settings/page.tsx` (CREATE): default export `SettingsPage` wraps an inner component in `RequireAuth`, exactly like `CollectionPage`/`DashboardPage`. The inner component calls `useCurrentUser()` and renders three states — loading (`ListSkeleton`, matching Dashboard/Collection's loading pattern), error, and the account-info block (email + "member since" line, using `toLocaleDateString()` on the `createdAt` string — no new date-formatting utility needed for a single call site).
- `account-menu.tsx` (MODIFY): add a `/settings` `Link` to the authenticated menu, alongside the existing Dashboard/Collection/My Submissions links, before the Log out button.
- `site-nav.test.tsx` (MODIFY): append one new `describe` block (following the file's existing per-run convention, e.g. "run_20260731_132040 criterion 7: My Submissions link") asserting `site-nav-settings-link` appears in the account menu when authenticated and is absent when not — every existing block is left untouched.
- `en.ts`/`es.ts` (MODIFY): add `nav.settings`, `settings.title`, `settings.emailLabel`, `settings.memberSinceLabel` to both dictionaries in the same pass (the `es.ts` `Record<MessageKey, string>` typing makes a one-sided addition a `tsc` error, so both must land together).

**Edge cases handled:**
- Unauthenticated `/settings` access: `RequireAuth` already redirects to `/login` before the inner component (and its `getCurrentUser()` call) ever mounts — no new logic needed, same as every other guarded page.
- Unauthenticated `GET /auth/me`: the global `JwtAuthGuard` rejects with 401 before the handler runs — no manual check needed.
- `passwordHash` leaking into the response: prevented at the Prisma `select` level (service), not just by the response shape (controller) — verified directly in `auth.service.spec.ts`.

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| apps/api/src/auth/auth.service.ts | MODIFY | Add `AuthService.me(userId)` |
| apps/api/src/auth/auth.controller.ts | MODIFY | Add guarded `GET /auth/me` handler |
| apps/api/src/auth/auth.controller.spec.ts | CREATE | Unit tests: guard metadata, delegation to `authService.me` |
| apps/api/src/auth/auth.service.spec.ts | CREATE | Unit tests: `me()` selects only `id`/`email`/`createdAt`, no `passwordHash` |
| apps/web/src/lib/auth-api.ts | MODIFY | Add `CurrentUser` type + `getCurrentUser()` |
| apps/web/src/lib/auth-api.test.ts | MODIFY | Add tests for `getCurrentUser()` |
| apps/web/src/lib/hooks/use-current-user.ts | CREATE | `useCurrentUser()` query hook |
| apps/web/src/app/settings/page.tsx | CREATE | `/settings` page: `RequireAuth` + account-info block |
| apps/web/src/app/settings/page.test.tsx | CREATE | Component test for the account-info block |
| apps/web/src/components/layout/account-menu.tsx | MODIFY | Add `/settings` link to the authenticated menu |
| apps/web/src/components/layout/site-nav.test.tsx | MODIFY | Add coverage for the new settings link |
| apps/web/src/lib/i18n/locales/en.ts | MODIFY | Add `nav.settings`, `settings.title`, `settings.emailLabel`, `settings.memberSinceLabel` |
| apps/web/src/lib/i18n/locales/es.ts | MODIFY | Add the same 4 keys (Spanish) |

## Interface Contract

This section is the single source of truth for all names. The Tester and Coder read this; neither invents anything independently.

### Backend

#### Service: `AuthService` (MODIFY) — `apps/api/src/auth/auth.service.ts`
- **New method:** `me(userId: string): Promise<RegisteredUser>`
  - Implementation: `this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, email: true, createdAt: true } })`
  - Return type: reuses the existing `RegisteredUser` interface (`{ id: string; email: string; createdAt: Date }`) already defined in this file — no new interface.

#### Controller: `AuthController` (MODIFY) — `apps/api/src/auth/auth.controller.ts`
- **New handler:** `me(@CurrentUser() user: AuthenticatedUser): Promise<RegisteredUser>`
  - Route: `@Get('me')`
  - **No `@Public()` decorator** — guarded by the global `JwtAuthGuard` (`APP_GUARD` in `app.module.ts`), same convention as `CatalogController.create`.
  - Body: `return this.authService.me(user.userId);`
  - Swagger decorators for consistency with `register`/`login`: `@ApiOperation({ summary: 'Get the current user' })`, `@ApiOkResponse(...)`, `@ApiUnauthorizedResponse(...)`.
- **Resulting route:** `GET /api/v1/auth/me` (global prefix `api/v1` per `main.ts`, confirmed via `auth.e2e-spec.ts`'s existing `/api/v1/auth/...` calls) — guarded, 401 if no/invalid bearer token.
- **Response shape (200):** `{ id: string, email: string, createdAt: string }` (Date serializes to ISO string over JSON) — **never** a `passwordHash` key.

### Frontend

#### Module: `auth-api` (MODIFY) — `apps/web/src/lib/auth-api.ts`
- **New export:** `interface CurrentUser { id: string; email: string; createdAt: string }`
- **New export:** `async function getCurrentUser(): Promise<CurrentUser>`
  - Implementation: `return apiFetch<CurrentUser>('/auth/me');` (GET, `apiFetch`'s default method)

#### Hook: `useCurrentUser` (CREATE) — `apps/web/src/lib/hooks/use-current-user.ts`
- **Export:** `export function useCurrentUser()`
- **Implementation:**
  ```typescript
  import { useQuery } from '@tanstack/react-query';
  import { getCurrentUser } from '@/lib/auth-api';

  export function useCurrentUser() {
    return useQuery({
      queryKey: ['auth', 'me'],
      queryFn: getCurrentUser,
    });
  }
  ```

#### Page: `SettingsPage` (CREATE) — `apps/web/src/app/settings/page.tsx`
- **Export:** `export default function SettingsPage()`
- **Structure:** `SettingsPage` renders `<RequireAuth><SettingsContent /></RequireAuth>` (matching `CollectionPage`'s outer/inner split — `RequireAuth` gates before any data fetch, exactly as in `collection/page.tsx` and `dashboard/page.tsx`).
- **Inner component `SettingsContent`** calls `useCurrentUser()` (`{ data, isLoading, isError }`) and renders:
  - Root: `<main data-testid="settings-page">`
  - `<h1>{t('settings.title')}</h1>`
  - Loading state: `isLoading && <div data-testid="settings-loading"><ListSkeleton /></div>`
  - Error state: `isError && <p data-testid="settings-error">{t('common.somethingWentWrong')}</p>`
  - Success state (`data` present): `<div data-testid="settings-account-info">` wrapping:
    - `<p data-testid="settings-email">{t('settings.emailLabel')}: {data.email}</p>`
    - `<p data-testid="settings-member-since">{t('settings.memberSinceLabel')}: {new Date(data.createdAt).toLocaleDateString()}</p>`
- **Test selectors:**
  - `data-testid="settings-page"` — root `<main>`
  - `data-testid="settings-loading"` — loading skeleton wrapper
  - `data-testid="settings-error"` — error message
  - `data-testid="settings-account-info"` — account-info block wrapper
  - `data-testid="settings-email"` — email display line
  - `data-testid="settings-member-since"` — member-since display line
- **Dependencies:** `@/components/auth/require-auth` (`RequireAuth`), `@/components/ui/list-skeleton` (`ListSkeleton`), `@/lib/hooks/use-current-user` (`useCurrentUser`), `@/lib/i18n/i18n-context` (`useTranslation`).

#### Component: `AccountMenu` (MODIFY) — `apps/web/src/components/layout/account-menu.tsx`
- Add one new `Link` inside the existing authenticated-menu `<div role="menu" data-testid="site-nav-account-menu">`, positioned after the `site-nav-my-submissions-link` link and before the `site-nav-logout` button:
  ```tsx
  <Link href="/settings" data-testid="site-nav-settings-link" className={menuLinkClassName} role="menuitem">
    {t('nav.settings')}
  </Link>
  ```
- **New test selector:** `data-testid="site-nav-settings-link"` — settings link inside the account menu, visible only when authenticated (same gating as `site-nav-dashboard-link`/`site-nav-collection-link`/`site-nav-my-submissions-link`, all inside the same authenticated-only menu).

### i18n keys (add to both `en.ts` and `es.ts`)

| Key | en | es |
|-----|----|----|
| `nav.settings` | `Settings` | `Configuración` |
| `settings.title` | `Settings` | `Configuración` |
| `settings.emailLabel` | `Email` | `Correo electrónico` |
| `settings.memberSinceLabel` | `Member since` | `Miembro desde` |

### Pre-existing testids (declared for contract-check purposes only)

The following testids already exist in untouched files and are referenced by `site-nav.test.tsx`'s preserved (unmodified) describe blocks — listed here so the mechanical contract checker doesn't flag them as undeclared:
- `data-testid="site-nav"` — existing, `site-nav.tsx`
- `data-testid="site-nav-account-trigger"` — existing, `site-nav.tsx`
- `data-testid="site-nav-account-menu"` — existing, `account-menu.tsx`
- `data-testid="site-nav-dashboard-link"` — existing, `account-menu.tsx`
- `data-testid="site-nav-collection-link"` — existing, `account-menu.tsx`
- `data-testid="site-nav-my-submissions-link"` — existing, `account-menu.tsx`
- `data-testid="site-nav-logout"` — existing, `account-menu.tsx`
- `data-testid="site-nav-login-link"` — existing, `site-nav.tsx`
- `data-testid="site-nav-signup-link"` — existing, `site-nav.tsx`
- `data-testid="site-nav-catalog-link"` — existing, `site-nav.tsx`
- `data-testid="site-nav-sets-link"` — existing, `site-nav.tsx`
- `data-testid="site-nav-glossary-link"` — existing, `site-nav.tsx`
- `data-testid="site-nav-brand"` — existing, `site-nav.tsx`
- `data-testid="language-switcher"` — existing, `language-switcher.tsx`
- `data-testid="language-switcher-select"` — existing, `language-switcher.tsx`

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. `GET /auth/me` guarded, 401 unauthenticated | `AuthController.me` (no `@Public()`, global `JwtAuthGuard`) |
| 2. `GET /auth/me` returns `{id, email, createdAt}`, no `passwordHash` | `AuthService.me`'s `select` |
| 3. Unit tests: shape + no passwordHash + 401 | `auth.controller.spec.ts`, `auth.service.spec.ts` |
| 4. `getCurrentUser()` in `auth-api.ts` | `auth-api.ts` MODIFY |
| 5. `/settings` renders email + member-since when authenticated | `settings/page.tsx`'s `settings-account-info`/`settings-email`/`settings-member-since` |
| 6. `/settings` redirects unauthenticated to `/login` | `RequireAuth` wrapper (existing, unmodified behavior) |
| 7. `/settings` nav link in authenticated group | `account-menu.tsx`'s `site-nav-settings-link` |
| 8. `nav.settings`/`settings.title`/`settings.emailLabel`/`settings.memberSinceLabel` in both `en.ts`/`es.ts` | i18n MODIFY |
| 9. Component test for account-info block | `settings/page.test.tsx` |
| 10. `typecheck`/`build`/`test`/`lint` all clean | Verified in Stage 6 sandbox |

## Risks and open questions

- **`findUniqueOrThrow` on a deleted user:** if a user record were deleted after their token was issued, `me()` would throw a Prisma `NotFoundError` rather than a clean 401/404. Out of scope per the PRD (no account-deletion feature exists in this app today) — left as the Coder's default Nest exception-filter behavior (500), not specially handled.
- **Date display formatting:** `toLocaleDateString()` renders in the server/test environment's default locale (not the user's selected app language) — acceptable for this scaffold since no other page in the repo has an existing date-formatting utility to reuse; a future task can introduce one if richer i18n-aware date formatting is wanted.
- **`packages/shared` rebuild gotcha (memory.md):** none of this run's changes touch `packages/shared/src`, so the known `dist/` rebuild requirement doesn't apply here, but the sandbox's automatic pre-test workspace build (per memory.md) covers it either way.
