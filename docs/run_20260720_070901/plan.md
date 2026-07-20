# Technical Plan: Sets — Coin Membership, Canonical-Set Reads, Public-Set Reads (Week 2, Day 2)

**Run:** run_20260720_070901
**Date:** 2026-07-20

## Summary

Extend the existing `SetsModule` (`apps/api/src/sets/`) with one owner-only write endpoint (`PATCH /sets/:id/coins`) and four unauthenticated read endpoints (`GET /sets/canonical`, `GET /sets/canonical/:id`, `GET /sets/public`, `GET /sets/public/:id`). No new module, controller, or service class is created — `SetsController`/`SetsService` gain new handlers/methods alongside the existing ones, reusing `SetsService.getOwnedSetOrThrow` for ownership and copying `CatalogService.findAll`'s pagination pattern for `GET /sets/public`. Two new DTOs and several new shared response/request types round out the change; `packages/shared/src/index.ts`'s existing exports are untouched, only extended.

## Approach

1. **`packages/shared/src/index.ts` (MODIFY, additive only)** — add `CanonicalSetSummary`, `CanonicalSetCoinItem`, `CanonicalSetDetail`, `UserSetCoinItem`, `UserSetDetail`, `UserSetCoinSummary`, `PatchSetCoinsRequest`. None of the five existing exports (`CatalogCoin`, `PaginatedResponse<T>`, `UserSetSummary`, `CloneFromRequest`, `CreateSetRequestBody`) are modified.

2. **`apps/api/src/sets/dto/patch-set-coins.dto.ts` (CREATE)** — `PatchSetCoinsDto` with optional `add`/`remove` arrays, each validated as `IsArray()` + `IsUUID('4', { each: true })` — an invalid entry in either array 400s before the handler runs, satisfying PRD criterion #2.

3. **`apps/api/src/sets/dto/find-public-sets-query.dto.ts` (CREATE)** — `FindPublicSetsQueryDto` with just `page`/`limit` (default 1/20, `@Type(() => Number)` + `@IsInt()` + `@Min(1)`), mirroring the tail of `FindCatalogQueryDto` without the catalog-only filter fields (country/denomination/name/yearMin/yearMax don't apply to sets).

4. **`apps/api/src/sets/sets.service.ts` (MODIFY)** — add five methods:
   - `patchCoins(userId, id, dto)`: calls `getOwnedSetOrThrow` first (404/403 reused unchanged); de-dupes `dto.add` via `[...new Set(...)]` before building `createMany` rows (guards against the same coin ID appearing twice in one `add` array, on top of `skipDuplicates` guarding against a coin already in the DB); computes `max(position)` and inserts adds inside one `$transaction`; runs `deleteMany` for removes outside the transaction (no ownership-table access, ever, in this method); returns the current `UserSetCoin` rows for the set, ordered by position.
   - `findAllCanonical()`: `prisma.canonicalSet.findMany({ orderBy: { name: 'asc' } })`.
   - `findCanonicalById(id)`: `prisma.canonicalSet.findUnique` with `include: { coins: { orderBy: { position: 'asc' }, include: { coin: true } } }`; throws `NotFoundException` if null.
   - `findAllPublic(query)`: same `Promise.all([findMany, count])` + `{ items, page, limit, total }` shape as `CatalogService.findAll`, `MAX_LIMIT = 100` clamp, no `where` filter (every `UserSet` row, no `userId` scoping).
   - `findPublicById(id)`: `prisma.userSet.findUnique` with the same `coins` include/orderBy shape as `findCanonicalById`; throws `NotFoundException` if null.

5. **`apps/api/src/sets/sets.controller.ts` (MODIFY)** — add five handlers. `@Get('canonical')`, `@Get('canonical/:id')`, `@Get('public')`, `@Get('public/:id')` are all `@Public()` and declared **above** the existing `@Patch(':id')`/`@Delete(':id')` and the new `@Patch(':id/coins')` in the file — this is the fix for the route-shadowing gotcha both the PRD and system-design_v2.md §3 call out explicitly. `@Patch(':id/coins')` requires auth (no `@Public()`), uses `@CurrentUser()` + `ParseUUIDPipe` on `:id` exactly like the existing `update`/`remove` handlers.

6. **`apps/api/src/sets/sets.module.ts`** — no change. `SetsController`/`SetsService` are already the sole controller/provider; no new providers are introduced.

Edge cases handled: empty set on first add (`max(position)` query returns `null` → treated as `0`, first coin lands at position 1); duplicate coin ID within one `add` array (de-duped in the service before `createMany`, so `skipDuplicates` never has to arbitrate a same-array collision); duplicate coin ID across two separate `PATCH` calls (`skipDuplicates: true` against `@@unique([userSetId, coinId])` handles this); remove-then-re-add of the same coin (removal is a real `deleteMany`, so the row is gone from the unique index and a later `createMany` re-adds it cleanly at the new `max(position) + 1`, not the old position); unknown canonical/public set id (`NotFoundException` → 404, same two-tier pattern as `getOwnedSetOrThrow` for consistency, though there is no ownership tier for a read of someone else's public/canonical set).

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| `packages/shared/src/index.ts` | MODIFY | Add `CanonicalSetSummary`, `CanonicalSetCoinItem`, `CanonicalSetDetail`, `UserSetCoinItem`, `UserSetDetail`, `UserSetCoinSummary`, `PatchSetCoinsRequest` |
| `apps/api/src/sets/dto/patch-set-coins.dto.ts` | CREATE | Request DTO for `PATCH /sets/:id/coins` |
| `apps/api/src/sets/dto/find-public-sets-query.dto.ts` | CREATE | Pagination query DTO for `GET /sets/public` |
| `apps/api/src/sets/sets.service.ts` | MODIFY | Add `patchCoins`, `findAllCanonical`, `findCanonicalById`, `findAllPublic`, `findPublicById` |
| `apps/api/src/sets/sets.controller.ts` | MODIFY | Add `PATCH /sets/:id/coins`, `GET /sets/canonical`, `GET /sets/canonical/:id`, `GET /sets/public`, `GET /sets/public/:id` — literal routes declared above `:id`-shaped ones |
| `apps/api/src/sets/sets.controller.spec.ts` | MODIFY | Delegation tests for the 5 new handlers, `@Public()` metadata assertions, route-declaration-order assertion |
| `apps/api/src/sets/sets.service.spec.ts` | MODIFY | Unit tests for the 5 new service methods against a mocked `PrismaService` |
| `apps/api/src/sets/dto/patch-set-coins.dto.spec.ts` | CREATE | class-validator tests for `PatchSetCoinsDto` (mirrors `create-set.dto.spec.ts`'s style) |
| `apps/api/src/sets/shared-types.spec.ts` | MODIFY | Extend the existing type-compile-check pattern (established Week 2 Day 1 per test-reviewer feedback) to cover the 7 new shared types, giving criterion #17 a real signal from `pnpm --filter api test` rather than deferring entirely to `typecheck`/`build` |

## Interface Contract

This section is the single source of truth for all names. The Tester and Coder read this; neither invents anything independently.

### Shared types (`packages/shared/src/index.ts`) — additive, append after existing exports

```typescript
export interface CanonicalSetSummary {
  id: string;
  name: string;
  description: string | null;
  source: string;
  templateVersion: string;
}

export interface CanonicalSetCoinItem {
  id: string;
  position: number;
  coin: CatalogCoin;
}

export interface CanonicalSetDetail extends CanonicalSetSummary {
  coins: CanonicalSetCoinItem[];
}

export interface UserSetCoinItem {
  id: string;
  position: number;
  coin: CatalogCoin;
}

export interface UserSetDetail extends UserSetSummary {
  coins: UserSetCoinItem[];
}

export interface UserSetCoinSummary {
  id: string;
  userSetId: string;
  coinId: string;
  position: number;
}

export interface PatchSetCoinsRequest {
  add?: string[];
  remove?: string[];
}
```

### DTO: PatchSetCoinsDto
- **File:** `apps/api/src/sets/dto/patch-set-coins.dto.ts`
- **Export:** `export class PatchSetCoinsDto`
- **Fields:**
  ```typescript
  class PatchSetCoinsDto {
    add?: string[];    // @IsOptional() @IsArray() @IsUUID('4', { each: true })
    remove?: string[]; // @IsOptional() @IsArray() @IsUUID('4', { each: true })
  }
  ```
- **Validation behavior:** both fields optional (an empty body `{}` is valid — no-op). A non-array value for either field fails `@IsArray()`. Any entry that is not a valid RFC 4122 UUID fails `@IsUUID('4', { each: true })` for that field, and `errors[].property` is `'add'` or `'remove'` respectively.
- **Dependencies:** `class-validator` (`IsArray`, `IsOptional`, `IsUUID`), `@nestjs/swagger` (`ApiPropertyOptional`) — both already in `apps/api/package.json`.

### DTO: FindPublicSetsQueryDto
- **File:** `apps/api/src/sets/dto/find-public-sets-query.dto.ts`
- **Export:** `export class FindPublicSetsQueryDto`
- **Fields:**
  ```typescript
  class FindPublicSetsQueryDto {
    page: number = 1;   // @IsOptional() @Type(() => Number) @IsInt() @Min(1)
    limit: number = 20; // @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  }
  ```
- **Dependencies:** `class-transformer` (`Type`), `class-validator` (`IsInt`, `IsOptional`, `Min`), `@nestjs/swagger` (`ApiPropertyOptional`) — same pattern as `apps/api/src/catalog/dto/find-catalog-query.dto.ts`.

### Service: SetsService — new methods (existing methods/constructor unchanged)
- **File:** `apps/api/src/sets/sets.service.ts` (already exists; `getOwnedSetOrThrow(userId, id): Promise<UserSet>` is the existing private helper — reused, not reimplemented)
- **New constant:** `const MAX_LIMIT = 100;` at module scope (same as `apps/api/src/catalog/catalog.service.ts`)
- **New methods:**
  ```typescript
  async patchCoins(userId: string, id: string, dto: PatchSetCoinsDto): Promise<UserSetCoinSummary[]>
  async findAllCanonical(): Promise<CanonicalSetSummary[]>
  async findCanonicalById(id: string): Promise<CanonicalSetDetail>
  async findAllPublic(query: FindPublicSetsQueryDto): Promise<PaginatedResponse<UserSetSummary>>
  async findPublicById(id: string): Promise<UserSetDetail>
  ```
- **`patchCoins` — exact Prisma calls the Tester's mock must cover:**
  1. `await this.getOwnedSetOrThrow(userId, id);` — first line, before anything else (404/403 short-circuit).
  2. `const toAdd = dto.add ? [...new Set(dto.add)] : [];` and `const toRemove = dto.remove ?? [];`
  3. If `toAdd.length > 0`: one `this.prisma.$transaction(async (tx) => { ... })` call containing:
     - `const maxPositionResult = await tx.userSetCoin.aggregate({ where: { userSetId: id }, _max: { position: true } });`
     - `const nextPosition = (maxPositionResult._max.position ?? 0) + 1;`
     - `await tx.userSetCoin.createMany({ data: toAdd.map((coinId, index) => ({ userSetId: id, coinId, position: nextPosition + index })), skipDuplicates: true });`
  4. If `toRemove.length > 0`: `await this.prisma.userSetCoin.deleteMany({ where: { userSetId: id, coinId: { in: toRemove } } });` — called directly on `this.prisma`, NOT inside the `$transaction`, and NEVER calls anything on `this.prisma.ownership`.
  5. If `toAdd.length === 0`, `$transaction`/`aggregate`/`createMany` are never called. If `toRemove.length === 0`, `deleteMany` is never called. (Both arrays absent/empty → only the ownership check and the final read run.)
  6. Return: `await this.prisma.userSetCoin.findMany({ where: { userSetId: id }, orderBy: { position: 'asc' } });`
- **`findAllCanonical`:** `return this.prisma.canonicalSet.findMany({ orderBy: { name: 'asc' } });`
- **`findCanonicalById`:**
  ```typescript
  const set = await this.prisma.canonicalSet.findUnique({
    where: { id },
    include: { coins: { orderBy: { position: 'asc' }, include: { coin: true } } },
  });
  if (!set) throw new NotFoundException('Canonical set not found');
  return set;
  ```
- **`findAllPublic`:**
  ```typescript
  const page = query.page;
  const limit = Math.min(query.limit, MAX_LIMIT);
  const [items, total] = await Promise.all([
    this.prisma.userSet.findMany({ skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'asc' } }),
    this.prisma.userSet.count(),
  ]);
  return { items, page, limit, total };
  ```
  (No `where` clause on either call — every `UserSet` row across every user, per system-design_v2.md §4.6.)
- **`findPublicById`:**
  ```typescript
  const set = await this.prisma.userSet.findUnique({
    where: { id },
    include: { coins: { orderBy: { position: 'asc' }, include: { coin: true } } },
  });
  if (!set) throw new NotFoundException('Set not found');
  return set;
  ```
- **Dependencies:** `PrismaService` (existing constructor injection, unchanged), `NotFoundException`/`ForbiddenException` from `@nestjs/common` (already imported), the new shared types above, `PatchSetCoinsDto`/`FindPublicSetsQueryDto`.

### Controller: SetsController — new handlers (existing handlers/constructor unchanged)
- **File:** `apps/api/src/sets/sets.controller.ts` (already exists)
- **Required new imports:** `Public` from `../auth/decorators/public.decorator`; the new DTOs; the new shared types; `Query` from `@nestjs/common` (not yet imported in this file).
- **Declaration order inside the class** (this exact order — literal-segment GETs before any `:id`-shaped route):
  1. `@Get()` `findAll` — existing, unchanged
  2. `@Post()` `create` — existing, unchanged
  3. `@Public() @Get('canonical')` `findAllCanonical(): Promise<CanonicalSetSummary[]>`
  4. `@Public() @Get('canonical/:id')` `findCanonicalById(@Param('id', ParseUUIDPipe) id: string): Promise<CanonicalSetDetail>`
  5. `@Public() @Get('public')` `findAllPublic(@Query() query: FindPublicSetsQueryDto): Promise<PaginatedResponse<UserSetSummary>>`
  6. `@Public() @Get('public/:id')` `findPublicById(@Param('id', ParseUUIDPipe) id: string): Promise<UserSetDetail>`
  7. `@Patch(':id')` `update` — existing, unchanged
  8. `@Patch(':id/coins')` `patchCoins(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string, @Body() dto: PatchSetCoinsDto): Promise<UserSetCoinSummary[]>` — NO `@Public()`, requires auth
  9. `@Delete(':id')` `remove` — existing, unchanged
- Every handler delegates to the identically-named `SetsService` method, passing `user.userId` first (for `patchCoins`) exactly like `update`/`remove` already do, and returns the service's result unchanged (no controller-level transformation).
- **Dependencies:** `SetsService` (existing constructor injection, unchanged).

### Test file: `apps/api/src/sets/dto/patch-set-coins.dto.spec.ts`
- Mirrors `create-set.dto.spec.ts`'s pattern exactly: `plainToInstance(PatchSetCoinsDto, body)` + `validate(instance)`, using the real UUID `3fa85f64-5717-4562-b3fc-2c963f66afa6` (and a second real UUID, e.g. `7c9e6679-7425-40de-944b-e07fc1f90ae7`) for positive-case fixtures — never a repeated-digit placeholder like `11111111-...`, which fails `@IsUUID()`'s RFC 4122 variant-nibble check.
- Cases: empty body `{}` passes (0 errors); `{ add: [uuid1, uuid2] }` passes; `{ remove: [uuid1] }` passes; `{ add: [uuid1], remove: [uuid2] }` passes; `{ add: ['not-a-uuid'] }` fails with an error on `add`; `{ add: 'not-an-array' }` fails with an error on `add`; same two cases mirrored for `remove`.

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. 404/403 ownership check on `PATCH /sets/:id/coins` | `SetsService.patchCoins` calling `getOwnedSetOrThrow` first |
| 2. UUID-array validation on `add`/`remove` | `PatchSetCoinsDto` (`@IsArray()` + `@IsUUID('4', { each: true })`) |
| 3. `max(position)`-based append in one `$transaction`, `skipDuplicates` against `@@unique([userSetId, coinId])` | `SetsService.patchCoins` step 3 (transaction/aggregate/createMany) |
| 4. Same coin ID twice in one call / across two calls → exactly one row | in-request de-dupe (`[...new Set(dto.add)]`) + `skipDuplicates: true` against the DB constraint |
| 5. Remove never touches `Ownership` | `SetsService.patchCoins` step 4 — `deleteMany` on `userSetCoin` only |
| 6. Add→remove→re-add produces no stale collision | `deleteMany` genuinely removes the row from the unique index; subsequent add reads a fresh `max(position)` |
| 7. `PATCH /sets/:id/coins` returns the set's current coin list | `SetsService.patchCoins` step 6 (`userSetCoin.findMany`, ordered by position) |
| 8. `GET /sets/canonical` public, lists all `CanonicalSet` rows | `SetsController.findAllCanonical` + `@Public()` + `SetsService.findAllCanonical` |
| 9. `GET /sets/canonical/:id` public, `ParseUUIDPipe`, ordered coin list, 404 on unknown | `SetsController.findCanonicalById` + `SetsService.findCanonicalById` |
| 10. `GET /sets/public` public, all `UserSet` rows, paginated, same shape as `GET /catalog` | `SetsController.findAllPublic` + `SetsService.findAllPublic` |
| 11. `GET /sets/public/:id` public, `ParseUUIDPipe`, ordered coin list, 404 on unknown | `SetsController.findPublicById` + `SetsService.findPublicById` |
| 12. No user-identifying field beyond existing `UserSetSummary` fields | `UserSetDetail`/`PaginatedResponse<UserSetSummary>` response shapes carry no email/display-name field |
| 13. Literal routes declared above `:id`-shaped routes | Controller declaration order (Interface Contract §Controller) |
| 14. `GET /sets/canonical` hits the list handler, not a `:id` handler | manual pass (task 2.4) — not a unit-test-only concern, verified against a running server |
| 15. All four new read endpoints return 200 with no `Authorization` header | `@Public()` on all four handlers; manual pass confirms at the HTTP level |
| 16. `GET /sets/public` paginates with no overlap/gap | `SetsService.findAllPublic`'s `skip`/`take` math (same as `CatalogService.findAll`, already proven correct in Week 1); manual pass with real rows |
| 17. New shared types added additively, no existing export modified | Interface Contract §Shared types — pure additions, no edits to `CatalogCoin`/`PaginatedResponse`/`UserSetSummary`/`CloneFromRequest`/`CreateSetRequestBody` |
| 18. `typecheck`/`build`/`test`/`lint` all clean | Coder runs all four before completion; sandbox re-verifies `test` |
| 19. `docs/backlog_week2.md` 2.1–2.5 checked off | Coder's final step, after manual pass |

## Risks and open questions

- **Manual-pass items (PRD criteria #4, #6, #14, #15, #16) are not fully covered by the automated unit-test suite** — they require a running server and real HTTP requests (curl/Postman) against the dev DB, per the task's own "Verify (manual pass — tasks 2.5)" section. The unit tests in this plan cover the underlying logic (dedup, position math, route delegation, `@Public()` metadata) at the mock level; the Coder is responsible for actually running the manual pass against a live `nest start` instance and cleaning up any throwaway data afterward, exactly as the task describes — this is expected to happen outside the Jest suite the sandbox runs, and its results are not gated by the automated pipeline's PASS/FAIL verdict.
- **`findCanonicalById`/`findPublicById`'s Prisma `include` shape is asserted at the mock level, not against a real Prisma Client type** — the unit tests assert `prisma.canonicalSet.findUnique`/`prisma.userSet.findUnique` were called with the expected `where`/`include` argument shape and that the mocked resolved value passes through unchanged; they cannot catch a genuine Prisma schema/relation-name typo (e.g. `coins` vs. `userSetCoins`) since the mock doesn't validate against the real schema. `pnpm --filter api build`/`typecheck` is the actual backstop for that class of error, since Prisma's generated client types would fail to compile against a wrong relation name.
- **Position de-duplication choice:** the task description says `createMany({ skipDuplicates: true })` alone is sufficient, relying on Postgres's `ON CONFLICT DO NOTHING` to handle same-array duplicates. This plan adds an explicit `[...new Set(dto.add)]` de-dupe before building the `data` array as a belt-and-suspenders correctness measure (it also avoids leaving unused position-number gaps from skipped in-array duplicates, though gaps are harmless per system-design_v2.md §4.1). This is a Coder implementation detail, not a contract deviation — the Tester's mock-level assertions should verify the *outcome* (final `createMany` call's `data` array has one entry per unique coin ID) rather than assuming Postgres conflict semantics, since the whole point of unit-testing this logic is to not depend on a real Postgres instance.
