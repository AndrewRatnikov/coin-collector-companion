# Technical Plan: Catalog endpoints + Wikipedia attribution footer (backlog_week1.md 5.1–5.2)

**Run:** run_20260719_190933
**Date:** 2026-07-19

## Summary

Add a new `CatalogModule` to `apps/api` exposing `GET /catalog` (filter + paginate) and
`GET /catalog/:id` (single-coin detail), both `@Public()`, reading only from the existing
`Coin` Prisma model — no new schema, no new dependency. Populate `packages/shared` with the
first real v2 types (`CatalogCoin`, `PaginatedResponse<T>`) so both apps share one definition.
Add a static one-line CC BY-SA 4.0 attribution footer to `apps/web`'s root layout. This mirrors
the existing `AuthModule`/`HealthController` shape exactly (`@Public()` decorator, Swagger
decorator style, DTO validation via the global `ValidationPipe`) so it reads as a natural
extension of the codebase, not a new pattern.

## Approach

- **Query DTO first.** `FindCatalogQueryDto` declares `country?`/`denomination?`/`name?` as
  plain optional strings, and `yearMin?`/`yearMax?`/`page`/`limit` as numbers converted from
  the raw query-string values via `@Type(() => Number)` (the known gotcha from the deleted v1
  `FindSetsQueryDto` — `@IsInt()` alone does not coerce a string). `page`/`limit` carry class-
  field defaults (`page = 1`, `limit = 20`) rather than being optional+defaulted in the
  service, since class-transformer's `plainToInstance` (which Nest's global `ValidationPipe`
  uses) preserves a class field's default value for any key absent from the incoming query
  object — the same idiom already used for `page`/`limit` defaults, just newly documented here
  since no existing DTO in this repo needed it before.
- **Limit is clamped, not rejected.** `@Max(100)` in the DTO would 400 a `limit=1000` request;
  the task instead calls for silently capping it ("a caller can't request the whole table in
  one response," not "a caller gets an error for asking"). So the DTO only validates `@IsInt()
  @Min(1)` on `limit`, and `CatalogService.findAll` does `Math.min(query.limit, MAX_LIMIT)`
  (`MAX_LIMIT = 100`) before using it in the Prisma query.
- **Filter construction.** `CatalogService.findAll` builds a single `Prisma.CoinWhereInput`:
  `country`/`denomination` as exact-match when present, `name` as `{ contains, mode:
  'insensitive' }` when present, `year` as an independent `{ gte?, lte? }` object assembled
  only from whichever of `yearMin`/`yearMax` is actually present (never both required, per PRD
  AC5). One `Promise.all([coin.findMany, coin.count])` against the same `where` — `findMany`
  paginated via `skip`/`take`, `count` unpaginated, so `total` is always the full filtered
  count, not `items.length` (PRD AC8). Ordered by `[{ year: 'asc' }, { id: 'asc' }]` — the
  first key gives it a sensible chronological browsing order, the second guarantees a fully
  deterministic sort so pagination never skips/duplicates a row across page boundaries (two
  coins can share a year).
- **Detail lookup.** `CatalogService.findOne(id)` is a plain `prisma.coin.findUnique({ where:
  { id } })`, throwing `NotFoundException` on a `null` result. The malformed-id → 400 case is
  handled entirely by `ParseUUIDPipe` on the controller's `:id` param — a framework guarantee,
  not custom logic — matching the exact reasoning SD §3 gives for `SetsController`.
- **No caching, no external call, anywhere in this path** — every acceptance criterion here is
  satisfiable by exactly two Prisma calls in `findAll` and one in `findOne`. `CatalogModule`
  imports nothing beyond `CatalogController`/`CatalogService`; `PrismaModule` is `@Global()`
  (per `app.module.ts`), so `CatalogService` injects `PrismaService` directly without
  `CatalogModule` importing `PrismaModule` itself — the same convention `AuthModule` already
  follows.
- **`packages/shared`.** `CatalogCoin` is a plain interface mirroring `Coin`'s scalar fields
  exactly, including `createdAt`/`updatedAt` typed as `Date` (not `string`) — this matches the
  existing `RegisteredUser` interface convention in `auth.service.ts` (also `createdAt: Date`),
  and keeps `Coin` (from `@prisma/client`) directly assignable to `CatalogCoin` with no mapping
  layer, exactly as the task brief says is safe here (no enum fields to cause the v1
  `CoinItemView`/`CoinDto` split's mismatch). `PaginatedResponse<T>` is the generic list-response
  envelope. The placeholder `export {}` in `packages/shared/src/index.ts` is replaced by these
  two real exports — no other v2 types exist yet, so there's no "pending" comment worth keeping.
- **Web footer.** A new `SiteFooter` component, rendered once in the root layout after
  `QueryProvider` (a context provider with no DOM wrapper of its own, so this is the last actual
  DOM child of `<body>`, whose existing `flex flex-col` on `<body>` is why `mt-auto` on the
  footer element reliably pins it to the bottom regardless of page content height). No new
  dependency, no client-side state — a plain server component.
- **Docs/changelog updates are explicitly not this plan's job.** `docs/backlog_week1.md`'s
  5.1–5.3 checkboxes and `CLAUDE.md`'s dated changelog paragraph both need to describe what was
  *actually verified live* against the real Neon dev DB — that evidence only exists after the
  code lands and the live checks run, which happens after this plan's automated test-and-build
  gate. The orchestrator handles both files directly as a final step once the live verification
  in the Definition of Done has actually happened, rather than having the Coder pre-write
  unverified claims into them now.

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| `packages/shared/src/index.ts` | MODIFY | Export `CatalogCoin` and `PaginatedResponse<T>`, replacing the placeholder `export {}` |
| `apps/api/src/catalog/dto/find-catalog-query.dto.ts` | CREATE | Query DTO for `GET /catalog` — validation + string→number transforms |
| `apps/api/src/catalog/catalog.service.ts` | CREATE | Prisma-backed filter/paginate + single-coin lookup |
| `apps/api/src/catalog/catalog.controller.ts` | CREATE | `GET /catalog`, `GET /catalog/:id`, both `@Public()` |
| `apps/api/src/catalog/catalog.module.ts` | CREATE | Wires controller + service |
| `apps/api/src/app.module.ts` | MODIFY | Import `CatalogModule` into `AppModule.imports` |
| `apps/web/src/components/layout/site-footer.tsx` | CREATE | One-line CC BY-SA 4.0 Wikipedia attribution footer |
| `apps/web/src/app/layout.tsx` | MODIFY | Render `SiteFooter` globally, after `QueryProvider` |

Test files (written by the Tester, committed before the above):

| File | Action | Purpose |
|------|--------|---------|
| `apps/api/src/catalog/catalog.service.spec.ts` | CREATE | Filter/pagination/clamp/detail-lookup behavior, mocked `PrismaService` |
| `apps/api/src/catalog/catalog.controller.spec.ts` | CREATE | Controller delegates query/id to the service unchanged |

## Interface Contract

This section is the single source of truth for all names. The Tester and Coder read this;
neither invents anything independently.

### Shared types: `packages/shared/src/index.ts`

```typescript
export interface CatalogCoin {
  id: string;
  numistaTypeId: string | null;
  country: string;
  denomination: string;
  year: number;
  mintMark: string;
  variety: string;
  name: string;
  imageUrl: string | null;
  imageSource: string | null;
  imageLicense: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedResponse<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}
```

### DTO: `FindCatalogQueryDto`
- **File:** `apps/api/src/catalog/dto/find-catalog-query.dto.ts`
- **Export:** `export class FindCatalogQueryDto`
- **Fields:**
  ```typescript
  country?: string;       // @IsOptional() @IsString()
  denomination?: string;  // @IsOptional() @IsString()
  name?: string;          // @IsOptional() @IsString()
  yearMin?: number;       // @IsOptional() @Type(() => Number) @IsInt()
  yearMax?: number;       // @IsOptional() @Type(() => Number) @IsInt()
  page: number = 1;       // @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  limit: number = 20;     // @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  ```
- No `@Max` on `limit` — clamping to 100 happens in `CatalogService`, not DTO validation.

### Service: `CatalogService`
- **File:** `apps/api/src/catalog/catalog.service.ts`
- **Export:** `export class CatalogService` (`@Injectable()`)
- **Constructor:** `constructor(private readonly prisma: PrismaService)`
- **Constant:** `const MAX_LIMIT = 100;` (module-level, used to clamp `limit`)
- **Methods:**
  ```typescript
  findAll(query: FindCatalogQueryDto): Promise<PaginatedResponse<CatalogCoin>>
  findOne(id: string): Promise<CatalogCoin>
  ```
- **Prisma calls the Tester's mock must cover exactly:**
  - `this.prisma.coin.findMany({ where, skip, take, orderBy })`
  - `this.prisma.coin.count({ where })`
  - `this.prisma.coin.findUnique({ where: { id } })`
- **Behavior contract:**
  - `findAll`: `page`/`limit` fall back to the DTO's own defaults (`1`/`20`) when absent;
    `limit` is `Math.min(query.limit, MAX_LIMIT)`; `skip = (page - 1) * limit`; `where.country`
    /`where.denomination` set only when the corresponding query field is a non-empty string;
    `where.name = { contains: query.name, mode: 'insensitive' }` only when `name` is present;
    `where.year` is built as `{ gte?, lte? }` from whichever of `yearMin`/`yearMax` is present
    (never forcing both); return value's `total` always comes from the separate `count` call.
  - `findOne`: throws `NotFoundException` (from `@nestjs/common`) when `findUnique` resolves
    `null`; otherwise returns the row directly (already shaped like `CatalogCoin`).

### Controller: `CatalogController`
- **File:** `apps/api/src/catalog/catalog.controller.ts`
- **Export:** `export class CatalogController`
- **Decorators:** `@ApiTags('catalog')`, `@Controller('catalog')`
- **Constructor:** `constructor(private readonly catalogService: CatalogService)`
- **Methods:**
  ```typescript
  @Public()
  @Get()
  @ApiOperation({ summary: '...' })
  @ApiOkResponse({ description: '...' })
  findAll(@Query() query: FindCatalogQueryDto): Promise<PaginatedResponse<CatalogCoin>>

  @Public()
  @Get(':id')
  @ApiOperation({ summary: '...' })
  @ApiOkResponse({ description: '...' })
  findOne(@Param('id', ParseUUIDPipe) id: string): Promise<CatalogCoin>
  ```
- `@Public()` imported from `../auth/decorators/public.decorator` (existing file, not new).
- Both methods are one-line delegations to `catalogService`'s matching method — no logic in
  the controller itself.

### Module: `CatalogModule`
- **File:** `apps/api/src/catalog/catalog.module.ts`
- **Export:** `export class CatalogModule`
- **Declaration:** `@Module({ controllers: [CatalogController], providers: [CatalogService] })`
- No `imports` — `PrismaModule` is global, and `CatalogModule` has no other module dependency.

### `AppModule` wiring
- **File:** `apps/api/src/app.module.ts`
- Add `import { CatalogModule } from './catalog/catalog.module';` and add `CatalogModule` to
  the `imports` array (after `AuthModule`) — no other change to this file.

### Component: `SiteFooter`
- **File:** `apps/web/src/components/layout/site-footer.tsx`
- **Export:** `export function SiteFooter()`
- **Props:** none
- **Structure:** a `<footer>` element, `mt-auto` + small/muted Tailwind classes (e.g. `py-4
  text-center text-xs text-gray-500 dark:text-gray-400`), containing one line of text
  attributing Wikipedia-derived catalog data to CC BY-SA 4.0 with an `<a href="https://
  en.wikipedia.org/wiki/Wikipedia:Reusing_Wikipedia_content" target="_blank" rel="noopener
  noreferrer">` link back to Wikipedia's own reuse-terms page (a real, general Wikipedia URL —
  satisfies `catalog-data-licensing.md` §1's "a general link to Wikipedia is sufficient here").
- **Test selectors:** none — `apps/web` has no test runner configured in `package.json` (no
  `test` script, no `jest`/`vitest` dependency), so this component is verified manually per the
  Definition of Done (`pnpm --filter web dev` + load a couple of routes), not by an automated
  test. Do not add a new test framework to satisfy this — out of scope and an unrequested
  dependency.
- **Dependencies:** none beyond React/Next built-ins already in `apps/web`.

### `RootLayout` wiring
- **File:** `apps/web/src/app/layout.tsx`
- Import `SiteFooter` from `@/components/layout/site-footer` and render `<SiteFooter />` as a
  sibling immediately after `<QueryProvider>{children}</QueryProvider>`, still inside `<body>`.
  No other change to this file (font setup, metadata, `<html>`/`<body>` classes untouched).

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. No auth required, 200 not 401 | `@Public()` on both `CatalogController` methods |
| 2. `country` exact match | `CatalogService.findAll`'s `where.country` |
| 3. `denomination` exact match | `CatalogService.findAll`'s `where.denomination` |
| 4. `name` case-insensitive substring | `where.name = { contains, mode: 'insensitive' }` |
| 5. `yearMin`/`yearMax` independent, inclusive | `where.year` built from whichever is present |
| 6. Default `page=1`/`limit=20` | `FindCatalogQueryDto` field defaults |
| 7. `limit` capped, not honored literally | `Math.min(query.limit, MAX_LIMIT)` in the service |
| 8. `{ items, page, limit, total }`, `total` = full count | `findAll`'s `Promise.all([findMany, count])` return shape |
| 9. `GET /catalog/:id` happy path, 200 | `CatalogService.findOne` + `ParseUUIDPipe` valid case |
| 10. Malformed id → 400 | `ParseUUIDPipe` on the `:id` param (framework behavior) |
| 11. Well-formed but nonexistent id → 404 | `NotFoundException` in `findOne` on a `null` result |
| 12. No external HTTP call in the request path | `CatalogModule` only calls `PrismaService`; verified by code review per DoD |
| 13. `packages/shared` exports `CatalogCoin`/`PaginatedResponse<T>`, builds | `packages/shared/src/index.ts` changes + `pnpm --filter @coin-collector/shared build` |
| 14. Footer renders globally, one line, CC BY-SA 4.0 + Wikipedia link | `SiteFooter` + `layout.tsx` wiring |
| 15. All typecheck/build/test/lint commands clean | No plan element on its own — verified at Stage 6 (sandbox) + final DoD pass |
| 16. Backlog + `CLAUDE.md` updated | Orchestrator's final step, after live verification (see Approach) |

## Risks and open questions

- **No automated test proves the malformed-UUID → 400 case or the live-filter correctness
  against real data** — both are framework-guaranteed (`ParseUUIDPipe`) or require the real
  Neon dev DB (the 142-row fixture), which the sandboxed test run does not have access to.
  These are exactly the checks backlog item 5.3 already calls out as a *manual* pass, so this
  is a deliberate scope decision, not a gap: automated unit tests (mocked Prisma) cover the
  service/controller logic in isolation; the live manual pass (done by the orchestrator after
  Stage 6 passes) covers the framework/DB-dependent behavior end-to-end.
- The footer's exact wording is not locked down beyond the constraints already stated (CC
  BY-SA 4.0 + a real Wikipedia link, one line, `mt-auto`-anchored) — the Coder has latitude on
  phrasing.
- `orderBy: [{ year: 'asc' }, { id: 'asc' }]` is a plan-level choice (not specified in SD/PRD)
  made solely to guarantee deterministic pagination for AC8's boundary check — the Coder should
  not deviate from a deterministic two-key sort even if a different concrete ordering is chosen.
