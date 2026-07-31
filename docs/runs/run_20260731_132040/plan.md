# Technical Plan: "My Submissions" — GET /catalog?submittedByMe=true

**Run:** run_20260731_132040
**Date:** 2026-07-31

## Summary

Add an authenticated-optional `submittedByMe` query param to the existing public `GET /catalog` endpoint, backed by a new route-scoped `OptionalJwtAuthGuard` (the first optional-auth pattern in this API). When honored (valid bearer token present), it swaps the service's hardcoded `status: 'approved'` filter for `submittedByUserId: <caller>` across all statuses; every other filter and the response shape are untouched. On the web app, a new `RequireAuth`-wrapped `/catalog/mine` page consumes it via a new `useMySubmissions()` hook, giving a signed-in user a way to find and recover a pending coin they lost track of after skipping the one-time submission-confirmation screen.

## Approach

**Backend:**
- `OptionalJwtAuthGuard` (new) is a route-level guard, not a global one — it overrides `AuthGuard('jwt')`'s `handleRequest` to swallow any Passport error/missing-user case and return `undefined` instead of throwing. Nest's `AuthGuard` mixin's `canActivate` always returns `true` regardless of what `handleRequest` returns (confirmed by reading the installed `@nestjs/passport` mixin source directly, not assumed) — it only assigns `request.user = handleRequest(...)`'s result and never itself throws unless `handleRequest` does. So this guard, applied via `@UseGuards(OptionalJwtAuthGuard)` on top of the already-`@Public()` `GET /catalog` route, populates `req.user` when a valid token is present and leaves it `undefined` otherwise, never rejecting the request either way.
- `OptionalCurrentUser()` (new) mirrors `CurrentUser()` but is typed `AuthenticatedUser | undefined` and reads `request.user` defensively (it may genuinely be absent).
- `CatalogController.findAll` keeps `@Public()` (global `JwtAuthGuard` still no-ops here) and adds `@UseGuards(OptionalJwtAuthGuard)` + the new `@OptionalCurrentUser()` param, passed through to the service as a plain `userId?: string`.
- `FindCatalogQueryDto` gets `submittedByMe?: boolean`, using `@Transform(({value}) => value === 'true')` + `@IsBoolean()` since query strings arrive as string literals under Nest's `transform: true` pipe (no existing precedent to copy for a query-string boolean; `SetOwnershipDto.owned` is body-only JSON so it needs no `@Transform`).
- `CatalogService.findAll(query, userId?)`: `submittedByMe && userId` replaces `status: 'approved'` with `submittedByUserId: userId` (all statuses); every other case (anonymous caller, or `submittedByMe` unset) falls back to today's `status: 'approved'` unchanged. All other filters (`country`/`denomination`/`name`/year range) are spread on top exactly as before — only the status-vs-submitter half of the `where` object changes shape.
- `CATALOG_COIN_SELECT` is untouched — `submittedByUserId` is still never selected, so the frontend never receives it back (it doesn't need to; it's the one that asked for `submittedByMe=true`).

**Frontend:**
- `CatalogFilters` (in `catalog-api.ts`) gains `submittedByMe?: boolean`; the existing `Object.entries` query-builder loop in `getCatalog` already stringifies any truthy value, so no other change is needed there — `apiFetch` already attaches the stored bearer token automatically whenever present, so no separate auth wiring is needed on the frontend at all.
- New `useMySubmissions()` hook wraps `useCatalog`-style fetching with its own query key `['catalog', 'mine']` (distinct from the plain browse cache).
- New `/catalog/mine` page (route decided here — a static segment, which Next.js's App Router matches before the sibling dynamic `catalog/[coinId]` segment, so no route-collision risk), `RequireAuth`-wrapped, listing every submission with a status badge distinguishing pending/approved/rejected (extending the binary pending/not-pending badge pattern from `catalog/[coinId]/page.tsx` to a real three-way label). Each row links to `catalog/[coinId]`, not to a set.
- Nav entry point: `site-nav.tsx`'s authenticated link group (confirmed no `settings/page.tsx` exists yet in this repo, so the backlog's fallback applies directly — no conditional to build).
- New i18n keys added to **both** `en.ts` and `es.ts` together (`es.ts`'s `Record<MessageKey, string>` typing makes a missing key a compile error, enforcing parity).

**Edge cases handled:**
- Anonymous caller with `submittedByMe=true`: silently ignored, identical to a normal anonymous call (criterion #2).
- Authenticated caller without `submittedByMe`: identical to today's behavior (criterion #3).
- `submittedByMe=true` combined with `country`/`denomination`/`name`/`yearMin`/`yearMax`: all still apply on top of the submitter filter (criterion #4).
- User B's `GET /catalog?submittedByMe=true` never includes user A's coins (enforced structurally — the where clause only ever matches the caller's own `userId`).

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| apps/api/src/auth/guards/optional-jwt-auth.guard.ts | CREATE | Route-level guard: never throws, populates `req.user` only when a valid bearer token is present |
| apps/api/src/auth/decorators/optional-current-user.decorator.ts | CREATE | `AuthenticatedUser \| undefined`-typed param decorator, parallel to `@CurrentUser()` |
| apps/api/src/catalog/catalog.controller.ts | MODIFY | Add `@UseGuards(OptionalJwtAuthGuard)` + `@OptionalCurrentUser()` param to `findAll` |
| apps/api/src/catalog/dto/find-catalog-query.dto.ts | MODIFY | Add `submittedByMe?: boolean` with query-string `@Transform` + `@IsBoolean()` |
| apps/api/src/catalog/dto/find-catalog-query.dto.spec.ts | CREATE | Exercises the real `plainToInstance`/`validate` transform pipeline for `submittedByMe` (same convention as `create-coin.dto.spec.ts`) — the only test file that actually proves the query-string `"true"`/`"false"` transform works, since `catalog.service.spec.ts`/`catalog.controller.spec.ts` construct the DTO via `Object.assign(new FindCatalogQueryDto(), ...)`, bypassing the transform pipeline entirely |
| apps/api/src/catalog/catalog.service.ts | MODIFY | `findAll(query, userId?)`: swap `status`/`submittedByUserId` filter based on `submittedByMe && userId` |
| apps/api/src/catalog/catalog.service.spec.ts | MODIFY | Add `submittedByMe` filter-construction cases; preserve all existing `findAll`/`findOne`/`create` cases verbatim |
| apps/api/src/catalog/catalog.controller.spec.ts | MODIFY | Update `findAll` call-site tests for the new `(query, user)` signature; add optional-auth pass-through cases; preserve `findOne`/`create` cases verbatim |
| apps/api/test/catalog-submitted-by-me.e2e-spec.ts | CREATE | Anonymous vs. authenticated `submittedByMe=true` behavior against a real (not mocked) Nest app — not run by the automated sandbox (see Risks) |
| apps/web/src/lib/catalog-api.ts | MODIFY | Add `submittedByMe?: boolean` to `CatalogFilters` |
| apps/web/src/lib/catalog-api.test.ts | MODIFY | Assert `submittedByMe=true` is appended to the query string when set; preserve existing cases verbatim |
| apps/web/src/lib/hooks/use-catalog.ts | MODIFY | Add `useMySubmissions()` hook, query key `['catalog', 'mine']` |
| apps/web/src/lib/hooks/use-catalog.test.tsx | MODIFY | Add `useMySubmissions` cases; preserve existing `useCatalog`/`useCoin`/`useSubmitCoin` cases verbatim |
| apps/web/src/app/catalog/mine/page.tsx | CREATE | `RequireAuth`-wrapped list of the caller's own submissions, any status, linking to `catalog/[coinId]` |
| apps/web/src/app/catalog/mine/page.test.tsx | CREATE | Renders mocked mixed-status list, correct badge per status, empty state |
| apps/web/src/components/layout/site-nav.tsx | MODIFY | Add authenticated-only link to `/catalog/mine` |
| apps/web/src/components/layout/site-nav.test.tsx | MODIFY | Assert the new link renders when authenticated, is absent when not; preserve existing cases verbatim |
| apps/web/src/lib/i18n/locales/en.ts | MODIFY | Add `nav.mySubmissions` + `mySubmissions.*` keys |
| apps/web/src/lib/i18n/locales/es.ts | MODIFY | Add the same keys (Spanish copy) — required for `tsc` to pass, parity enforced by `Record<MessageKey, string>` |

## Interface Contract

This section is the single source of truth for all names. The Tester and Coder read this; neither invents anything independently.

### Guard: `OptionalJwtAuthGuard`
- **File:** `apps/api/src/auth/guards/optional-jwt-auth.guard.ts`
- **Export:** `export class OptionalJwtAuthGuard extends AuthGuard('jwt')`
- **Behavior contract:**
  - Overrides `handleRequest(err, user, info, context, status)` to return `user || undefined` — **never** throws, regardless of `err` or a missing/invalid/expired token.
  - No constructor / no injected dependencies (unlike `JwtAuthGuard`, which needs `Reflector` for its `@Public()` check — this guard doesn't need one).
  - Applied via `@UseGuards(OptionalJwtAuthGuard)` at the method level on `CatalogController.findAll` only. Does not touch `AppModule`'s global `APP_GUARD` array.
- **Dependencies:** `@nestjs/passport`'s `AuthGuard`; `AuthenticatedUser` type from `../strategies/jwt.strategy`.

### Decorator: `OptionalCurrentUser`
- **File:** `apps/api/src/auth/decorators/optional-current-user.decorator.ts`
- **Export:** `export const OptionalCurrentUser = createParamDecorator(...)`
- **Return type:** `AuthenticatedUser | undefined` — reads `request.user`, does not assume it is set.
- **Dependencies:** `createParamDecorator` from `@nestjs/common`; `AuthenticatedUser` from `../strategies/jwt.strategy`.

### DTO field: `FindCatalogQueryDto.submittedByMe`
- **File:** `apps/api/src/catalog/dto/find-catalog-query.dto.ts` (MODIFY — existing fields unchanged)
- **New field:**
  ```typescript
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  @IsBoolean()
  submittedByMe?: boolean;
  ```
- **New import:** `IsBoolean` added to the existing `class-validator` import line; `Transform` added from `class-transformer`.
- Behavior: absent key → `undefined` (existing `@IsOptional()` handles this, no default needed — unlike `mintMark`/`variety`'s empty-string-default case elsewhere in this repo, "not requested" is exactly what `undefined` should mean here, so the `@Transform`-doesn't-fire-on-absent-key gotcha does not apply). String `"true"` → `true`; anything else (including `"false"` or absent) → `false`/`undefined`.

### DTO test file: `find-catalog-query.dto.spec.ts`
- **File:** `apps/api/src/catalog/dto/find-catalog-query.dto.spec.ts`
- Uses `plainToInstance(FindCatalogQueryDto, body)` + `validate(instance)` (the real, installed `class-transformer`/`class-validator`, no mocking — same convention as `create-coin.dto.spec.ts`).
- Must prove: query string `"true"` → `instance.submittedByMe === true`; `"false"` → `false`; key entirely absent → `instance.submittedByMe === undefined` (not `false`) and zero validation errors; a non-boolean-shaped string (e.g. `"yes"`) → transform yields `false` (since only exact `"true"` matches) and still zero validation errors (matches the field being optional).

### Controller: `CatalogController.findAll`
- **File:** `apps/api/src/catalog/catalog.controller.ts` (MODIFY — `findOne`/`create` unchanged)
- **New signature:**
  ```typescript
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @Get()
  findAll(
    @Query() query: FindCatalogQueryDto,
    @OptionalCurrentUser() user: AuthenticatedUser | undefined,
  ): Promise<PaginatedResponse<CatalogCoin>> {
    return this.catalogService.findAll(query, user?.userId);
  }
  ```
- **New imports:** `UseGuards` added to the existing `@nestjs/common` import line; `OptionalJwtAuthGuard` from `../auth/guards/optional-jwt-auth.guard`; `OptionalCurrentUser` from `../auth/decorators/optional-current-user.decorator`.
- `@Public()` stays — the global `JwtAuthGuard` still no-ops on this route; `OptionalJwtAuthGuard` runs as the method-level guard afterward and is the one that actually attempts Passport verification.

### Service: `CatalogService.findAll`
- **File:** `apps/api/src/catalog/catalog.service.ts` (MODIFY — `findOne`/`create` unchanged)
- **New signature:** `async findAll(query: FindCatalogQueryDto, userId?: string): Promise<PaginatedResponse<CatalogCoin>>`
- **New `where` construction:**
  ```typescript
  const where: Prisma.CoinWhereInput = {
    ...(query.submittedByMe && userId ? { submittedByUserId: userId } : { status: 'approved' }),
    ...(query.country ? { country: query.country } : {}),
    ...(query.denomination ? { denomination: query.denomination } : {}),
    ...(query.name ? { name: { contains: query.name, mode: 'insensitive' as const } } : {}),
    ...(query.yearMin !== undefined || query.yearMax !== undefined
      ? { year: { ...(query.yearMin !== undefined ? { gte: query.yearMin } : {}), ...(query.yearMax !== undefined ? { lte: query.yearMax } : {}) } }
      : {}),
  };
  ```
  (country/denomination/name/year spread blocks are copied verbatim from the existing implementation — only the first spread's condition changes.)
- `CATALOG_COIN_SELECT` is unchanged — no new field is ever selected or returned.

### Hook: `useMySubmissions`
- **File:** `apps/web/src/lib/hooks/use-catalog.ts` (MODIFY — `useCatalog`/`useCoin`/`useSubmitCoin` unchanged)
- **Export:**
  ```typescript
  export function useMySubmissions() {
    return useQuery({
      queryKey: ['catalog', 'mine'],
      queryFn: () => getCatalog({ submittedByMe: true }),
    });
  }
  ```
- Return shape: same as `useCatalog` — `{ data, isLoading, isError }` where `data` is `PaginatedResponse<CatalogCoin>` when loaded.

### Type: `CatalogFilters.submittedByMe`
- **File:** `apps/web/src/lib/catalog-api.ts` (MODIFY — `getCatalog`/`getCoin`/`submitCoin` bodies unchanged)
- **New field:** `submittedByMe?: boolean;` added to the `CatalogFilters` interface only.

### Component: `MySubmissionsPage` (default export) / `MySubmissionsList` (internal)
- **File:** `apps/web/src/app/catalog/mine/page.tsx`
- **Route:** `/catalog/mine` (static segment — resolved before the sibling `catalog/[coinId]` dynamic segment by Next's App Router)
- **Export:** `export default function MySubmissionsPage()` — renders `<RequireAuth><MySubmissionsList /></RequireAuth>`
- **Test selectors:**
  - `data-testid="my-submissions-page"` — root `<main>`
  - `data-testid="my-submissions-loading"` — shown while `isLoading`
  - `data-testid="my-submissions-error"` — shown when `isError`
  - `data-testid="my-submissions-empty"` — shown when loaded and `data.items.length === 0`
  - `data-testid="my-submissions-list"` — `<ul>`, shown when loaded and non-empty
  - `data-testid="my-submissions-item"` — one per `<li>` row
  - `data-testid="my-submissions-status-badge"` — status label span inside each row; text content is one of the three `mySubmissions.status*` i18n strings depending on `coin.status`
  - Each row's link text is `formatCoinLabel(coin)` (same convention as `collection/page.tsx`'s row rendering — NOT the raw `coin.name` field, which `formatCoinLabel` does not use), wrapped in `<Link href={`/catalog/${coin.id}`}>` to the coin's own detail page
- **Dependencies:** `useMySubmissions` (`@/lib/hooks/use-catalog`), `RequireAuth` (`@/components/auth/require-auth`), `ListSkeleton` (`@/components/ui/list-skeleton`), `formatCoinLabel`/`CoinStatus` (`@coin-collector/shared`), `useTranslation` (`@/lib/i18n/i18n-context`).
- **Status → i18n key map (internal, not exported):** `{ pending: 'mySubmissions.statusPending', approved: 'mySubmissions.statusApproved', rejected: 'mySubmissions.statusRejected' }`

### Component: `SiteNav` (MODIFY)
- **File:** `apps/web/src/components/layout/site-nav.tsx`
- **Change:** one new `<Link>` inside the existing authenticated-only group (the `isAuthenticated ? (...) : (...)` block), placed after the Collection link and before Log out:
  ```tsx
  <Link href="/catalog/mine" data-testid="site-nav-my-submissions-link" className={navLinkClassName}>
    {t('nav.mySubmissions')}
  </Link>
  ```
- No other markup in this file changes.

### i18n keys (add to both `en.ts` and `es.ts`)
| Key | en | es |
|-----|----|----|
| `nav.mySubmissions` | My Submissions | Mis envíos |
| `mySubmissions.title` | My Submissions | Mis envíos |
| `mySubmissions.errorLoading` | Something went wrong loading your submissions. Please try again. | Algo salió mal al cargar tus envíos. Inténtalo de nuevo. |
| `mySubmissions.emptyMessage` | You haven't submitted any coins yet. | Aún no has enviado ninguna moneda. |
| `mySubmissions.statusPending` | Pending review | Pendiente de revisión |
| `mySubmissions.statusApproved` | Approved | Aprobada |
| `mySubmissions.statusRejected` | Not approved | No aprobada |

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. Authenticated `submittedByMe=true` returns caller's own coins, all statuses | `CatalogService.findAll`'s `submittedByMe && userId` branch |
| 2. Anonymous `submittedByMe=true` behaves like a normal anonymous call | `OptionalJwtAuthGuard` never throws + leaves `user` undefined; service falls back to `status: 'approved'` when `userId` is undefined |
| 3. `submittedByMe` absent/false is unaffected, any caller | Same branch condition — false when `submittedByMe` falsy regardless of `userId` |
| 4. Other filters still apply on top | Existing spread blocks for country/denomination/name/year, unchanged, still spread after the new first block |
| 5. Response shape unchanged, `submittedByUserId` never returned | `CATALOG_COIN_SELECT` untouched |
| 6. `/catalog/mine` lists all submissions with status badges | `MySubmissionsPage`/`MySubmissionsList`, `my-submissions-status-badge` per item |
| 7. Discoverable link from authenticated part of the site | `SiteNav`'s new `site-nav-my-submissions-link` |
| 8. Each row links to `catalog/[coinId]`, not to a set | `<Link href={`/catalog/${coin.id}`}>` |
| 9. Page is auth-gated | `RequireAuth` wrapper |
| 10. New strings in both `en.ts` and `es.ts` | i18n keys table above |

## Pre-existing testids (declared for contract-check purposes only)

`site-nav.test.tsx`'s preserved (unmodified) describe blocks reference testids from prior runs' Interface Contracts, not new to this run — restated here in literal `data-testid="..."` form only so the mechanical contract check (which does a flat grep of that exact pattern across this run's `plan.md` alone, per `memory.md`'s recorded gotcha from run_20260722_121303) doesn't flag them as invented:

- `data-testid="site-nav"`
- `data-testid="site-nav-catalog-link"`
- `data-testid="site-nav-canonical-link"`
- `data-testid="site-nav-public-link"`
- `data-testid="site-nav-dashboard-link"`
- `data-testid="site-nav-collection-link"`
- `data-testid="site-nav-logout"`
- `data-testid="site-nav-login-link"`
- `data-testid="site-nav-signup-link"`
- `data-testid="site-nav-brand"`
- `data-testid="language-switcher"`
- `data-testid="language-switcher-select"`

## Risks and open questions

- **`test:e2e` (including the new `catalog-submitted-by-me.e2e-spec.ts`) is not run by the automated sandbox.** Per this repo's established pattern (`memory.md` Known gotchas, run_20260720_121716), the disposable sandbox worktree has no real `DATABASE_URL`/Neon credentials — live-DB e2e verification is an out-of-band manual step (backlog task 1.8), not something the Coder/sandbox stages execute. The e2e spec file is still written (backlog 1.7) for a human to run later against the real dev DB. `repo-digest.md`'s Test command has been corrected to run unit tests only (`pnpm --filter api test && pnpm --filter web test`), not `test:e2e`.
- **`Prisma.PrismaClientKnownRequestError` needs a real generated Prisma client at sandbox test time**, since `catalog.service.spec.ts`'s existing (untouched) `create` tests already construct one directly (see file). Per `memory.md`'s recorded gotcha (run_20260720_142942/171320), the sandbox's fresh `git worktree` has no `apps/api/.env` (gitignored) and `prisma generate`'s postinstall can silently produce an incomplete client without a `DATABASE_URL` present. `repo-digest.md`'s Test command has been updated to export a placeholder `DATABASE_URL` and run `pnpm --filter api exec prisma generate` before the test commands, applying that fix proactively rather than discovering it via a false sandbox FAIL.
- **Route path (`/catalog/mine`) and nav placement (site-nav vs. settings) were both left "TBD at implementation time" by the backlog** — both are decided in this plan: `/catalog/mine` (no collision with `catalog/[coinId]`, confirmed via Next's static-over-dynamic route precedence), and `site-nav.tsx` directly (confirmed `apps/web/src/app/settings/page.tsx` does not exist yet in this repo).
- **`OptionalJwtAuthGuard` has no constructor/DI dependencies**, so `@UseGuards(OptionalJwtAuthGuard)` at the method level works without any provider registration in `CatalogModule` — confirmed by reading the installed `@nestjs/passport` `AuthGuard` mixin source (its constructor only takes an `@Optional()` `AuthModuleOptions`, and our override adds no constructor of its own).
- Manual/live-DB passes (backend 1.8, frontend 2.7) and the `CLAUDE.md`/`system-design_v2.md` §4.7 documentation update (3.2) are explicitly out of scope for the automated Coder/Tester/sandbox stages — left as follow-up items for the human running this pipeline, noted here rather than silently dropped.
