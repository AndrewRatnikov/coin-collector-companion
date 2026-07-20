# Technical Plan: Collection/Ownership Module + Gap View (Week 2, Day 4)

**Run:** run_20260720_142942
**Date:** 2026-07-20

## Summary

Add a new `CollectionModule` (`apps/api/src/collection/`) with `PATCH /collection/:coinId` (idempotent upsert-or-delete against `ownership`) and `GET /collection` (unpaginated, `country`/`year` filters), registered in `AppModule` alongside `SetsModule`. Extend the existing `SetsController`/`SetsService` with `GET /sets/:id/gaps` — the one `:id` handler in that controller that deliberately skips `getOwnedSetOrThrow` and has no 403 branch, since gap view is readable against any set. Five new shared types are added additively to `packages/shared/src/index.ts`; none of the existing exports change.

## Approach

1. **`packages/shared/src/index.ts` (MODIFY, additive only)** — add `OwnershipItem`, `SetOwnershipRequest`, `SetOwnershipResponse`, `GapSlot`, `GapViewResponse`. None of the twelve existing exports (`CatalogCoin`, `PaginatedResponse<T>`, `UserSetSummary`, `CloneFromRequest`, `CreateSetRequestBody`, `CanonicalSetSummary`, `CanonicalSetCoinItem`, `CanonicalSetDetail`, `UserSetCoinItem`, `UserSetDetail`, `UserSetCoinSummary`, `PatchSetCoinsRequest`) are modified.

2. **`apps/api/src/collection/dto/set-ownership.dto.ts` (CREATE)** — `SetOwnershipDto`, one required field `owned: boolean` (`@IsBoolean()`). Body-shape mirror of `SetOwnershipRequest`.

3. **`apps/api/src/collection/dto/find-collection-query.dto.ts` (CREATE)** — `FindCollectionQueryDto` with optional `country` (`@IsString()`) and `year` (`@Type(() => Number)` + `@IsInt()`), mirroring `FindCatalogQueryDto`'s style minus the pagination fields (`GET /collection` is unpaginated, same "genuinely per-user and bounded" reasoning as `GET /sets`, SD §3).

4. **`apps/api/src/collection/collection.service.ts` (CREATE)** — `CollectionService` with two methods:
   - `setOwnership(userId, coinId, owned)`: `owned: true` → `prisma.ownership.upsert({ where: { userId_coinId: { userId, coinId } }, create: { userId, coinId }, update: {} })` inside a `try`/`catch` that maps `Prisma.PrismaClientKnownRequestError` with `code === 'P2003'` (FK violation — unknown `coinId`) to `NotFoundException`, mirroring `AuthService.register`'s existing `P2002` → `ConflictException` pattern (`apps/api/src/auth/auth.service.ts`) rather than inventing a new error-handling idiom. `update: {}` writes nothing on conflict, so `ownedAt` on an already-owned row is left exactly as it was — re-marking an already-owned coin does not reset `ownedAt` (PRD criterion #3, resolves the task prompt's open question explicitly in favor of preserving the original timestamp, since `ownedAt` is documented in system-design_v2.md §4.1 as "when it was marked owned," and a `true`-on-`true` upsert isn't a new "marking" event). `owned: false` → `prisma.ownership.deleteMany({ where: { userId, coinId } })` — no `try`/`catch` needed, `deleteMany` never throws on zero matches.
   - `findAll(userId, query)`: `prisma.ownership.findMany({ where: { userId, coin: { ...(query.country !== undefined ? { country: query.country } : {}), ...(query.year !== undefined ? { year: query.year } : {}) } }, include: { coin: true }, orderBy: { ownedAt: 'desc' } })` — a relation filter through `coin`, since `Ownership` has no `country`/`year` columns of its own. The `coin` key is always present in `where` (as `{}` when no filters given), which is a no-op filter on a required relation, not an accidental exclusion.

5. **`apps/api/src/collection/collection.controller.ts` (CREATE)** — `CollectionController`, `@Controller('collection')`, no `@Public()` anywhere (both routes require auth). `GET /collection` (`@Get()`) takes `@Query() query: FindCollectionQueryDto`, delegates to `findAll(user.userId, query)`. `PATCH /collection/:coinId` (`@Patch(':coinId')`) takes `@Param('coinId', ParseUUIDPipe) coinId: string` and `@Body() dto: SetOwnershipDto`, delegates to `setOwnership(user.userId, coinId, dto.owned)`.

6. **`apps/api/src/collection/collection.module.ts` (CREATE)** — `CollectionModule`, `controllers: [CollectionController]`, `providers: [CollectionService]`. No explicit `PrismaModule` import needed — it's `@Global()` (`apps/api/src/prisma/prisma.module.ts`), same as `SetsModule` already relies on.

7. **`apps/api/src/app.module.ts` (MODIFY)** — import `CollectionModule` and add it to the `imports` array, alongside `SetsModule`.

8. **`apps/api/src/sets/sets.service.ts` (MODIFY)** — add one method, `getGaps(callerId, setId)`:
   ```typescript
   const set = await this.prisma.userSet.findUnique({
     where: { id: setId },
     include: {
       coins: {
         orderBy: { position: 'asc' },
         include: { coin: { include: { ownerships: { where: { userId: callerId } } } } },
       },
     },
   });
   if (!set) throw new NotFoundException('Set not found');

   const totalCount = set.coins.length;
   const slots = set.coins.map((usc) => ({
     id: usc.id,
     position: usc.position,
     coin: usc.coin,
     owned: usc.coin.ownerships.length > 0,
   }));
   const ownedCount = slots.filter((s) => s.owned).length;
   const completionPercent = totalCount === 0 ? 0 : Math.round((ownedCount / totalCount) * 100);

   return { setId, ownedCount, totalCount, completionPercent, slots };
   ```
   One query (`userSet.findUnique` with nested `include`), no per-slot loop against the DB — the `Coin.ownerships` reverse relation (`apps/api/prisma/schema.prisma`, already declared on the `Coin` model) filtered to `userId: callerId` is what makes "owned by the caller, regardless of who owns the set" a single round trip. Deliberately does **not** call `getOwnedSetOrThrow` and has no `ForbiddenException` branch — this is the one `:id` read in `SetsService` that isn't owner-scoped, per system-design_v2.md §4.6.

9. **`apps/api/src/sets/sets.controller.ts` (MODIFY)** — add `@Get(':id/gaps')` `getGaps(@CurrentUser() user: AuthenticatedUser, @Param('id', ParseUUIDPipe) id: string): Promise<GapViewResponse>`, declared after the existing `@Delete(':id') remove` handler (last method in the class). No `@Public()`. Requires the new `GapViewResponse` type import. This does not reopen the Day 2 route-ordering concern (system-design_v2.md §3): that concern is specifically about a literal segment (`canonical`, `public`) colliding with a bare `:id` route under the *same* HTTP method: `:id/gaps` is a distinct path shape from every existing `GET`, so there is no ambiguity for NestJS's router to resolve regardless of where in the class it's declared.

10. **`docs/backlog_week2.md` (MODIFY)** — check off `4.1`, `4.2`, `4.3` with brief deviation notes (the `ownedAt`-preservation and 404-on-unknown-`coinId` decisions), matching the style of the already-checked Day 1–3 entries. `4.4` and `4.5` stay **unchecked**, each with a one-line "pending manual pass — requires the live dev DB, not run by the automated pipeline" note appended, consistent with this repo's established convention (see `## Risks and open questions` below and `memory.md`'s "Known gotchas" on live-DB verification).

Edge cases handled: `owned: true` on an already-owned coin (no error, `ownedAt` unchanged — criterion #3); `owned: false` on a never-owned coin (no error, `deleteMany` matches zero rows); `owned: true` against an unknown `coinId` (404, not a raw FK-violation 500 — criterion #6); `GET /sets/:id/gaps` on a set with zero coins (`completionPercent: 0`, no division by zero); `GET /sets/:id/gaps` on an unknown set id (404); `GET /sets/:id/gaps` on a set the caller doesn't own (200, caller's own ownership only, via the `ownerships: { where: { userId: callerId } } }` filter — the owning user's ownership rows are never fetched, so there's no data to leak even at the query level, not just the response-shaping level).

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| `packages/shared/src/index.ts` | MODIFY | Add `OwnershipItem`, `SetOwnershipRequest`, `SetOwnershipResponse`, `GapSlot`, `GapViewResponse` |
| `apps/api/src/collection/dto/set-ownership.dto.ts` | CREATE | Request DTO for `PATCH /collection/:coinId` |
| `apps/api/src/collection/dto/find-collection-query.dto.ts` | CREATE | Query DTO for `GET /collection` |
| `apps/api/src/collection/collection.service.ts` | CREATE | `setOwnership`, `findAll` |
| `apps/api/src/collection/collection.controller.ts` | CREATE | `PATCH /collection/:coinId`, `GET /collection` |
| `apps/api/src/collection/collection.module.ts` | CREATE | `CollectionModule` |
| `apps/api/src/app.module.ts` | MODIFY | Register `CollectionModule` |
| `apps/api/src/sets/sets.service.ts` | MODIFY | Add `getGaps` |
| `apps/api/src/sets/sets.controller.ts` | MODIFY | Add `GET /sets/:id/gaps` |
| `apps/api/src/collection/collection.controller.spec.ts` | CREATE | Delegation tests, no-`@Public()` assertions |
| `apps/api/src/collection/collection.service.spec.ts` | CREATE | Unit tests for `setOwnership`/`findAll` against a mocked `PrismaService` |
| `apps/api/src/collection/dto/set-ownership.dto.spec.ts` | CREATE | class-validator tests for `SetOwnershipDto` |
| `apps/api/src/collection/dto/find-collection-query.dto.spec.ts` | CREATE | class-validator tests for `FindCollectionQueryDto` |
| `apps/api/src/sets/sets.controller.spec.ts` | MODIFY | Add delegation test + no-`@Public()` assertion for `getGaps` |
| `apps/api/src/sets/sets.service.spec.ts` | MODIFY | Add unit tests for `getGaps` against a mocked `PrismaService` |
| `apps/api/src/sets/shared-types.spec.ts` | MODIFY | Extend the existing type-compile-check pattern to cover the 5 new shared types |
| `docs/backlog_week2.md` | MODIFY | Check off 4.1–4.3 with deviation notes; leave 4.4–4.5 unchecked with a pending-manual-pass note |

## Interface Contract

This section is the single source of truth for all names. The Tester and Coder read this; neither invents anything independently.

### Shared types (`packages/shared/src/index.ts`) — additive, append after existing exports

```typescript
export interface OwnershipItem {
  coinId: string;
  coin: CatalogCoin;
  ownedAt: Date;
}

export interface SetOwnershipRequest {
  owned: boolean;
}

export interface SetOwnershipResponse {
  coinId: string;
  owned: boolean;
  ownedAt: Date | null;
}

export interface GapSlot {
  id: string;
  position: number;
  coin: CatalogCoin;
  owned: boolean;
}

export interface GapViewResponse {
  setId: string;
  ownedCount: number;
  totalCount: number;
  completionPercent: number;
  slots: GapSlot[];
}
```

### DTO: SetOwnershipDto
- **File:** `apps/api/src/collection/dto/set-ownership.dto.ts`
- **Export:** `export class SetOwnershipDto`
- **Fields:**
  ```typescript
  class SetOwnershipDto {
    owned!: boolean; // @IsBoolean()
  }
  ```
- **Validation behavior:** `owned` is required. A non-boolean value (string `"true"`, number `1`, `null`, missing) fails `@IsBoolean()` with `errors[0].property === 'owned'`.
- **Dependencies:** `class-validator` (`IsBoolean`), `@nestjs/swagger` (`ApiProperty`) — both already in `apps/api/package.json`.

### DTO: FindCollectionQueryDto
- **File:** `apps/api/src/collection/dto/find-collection-query.dto.ts`
- **Export:** `export class FindCollectionQueryDto`
- **Fields:**
  ```typescript
  class FindCollectionQueryDto {
    country?: string; // @IsOptional() @IsString()
    year?: number;    // @IsOptional() @Type(() => Number) @IsInt()
  }
  ```
- **Dependencies:** `class-transformer` (`Type`), `class-validator` (`IsInt`, `IsOptional`, `IsString`), `@nestjs/swagger` (`ApiPropertyOptional`) — same pattern as `apps/api/src/catalog/dto/find-catalog-query.dto.ts`.

### Service: CollectionService
- **File:** `apps/api/src/collection/collection.service.ts`
- **Export:** `export class CollectionService`
- **Constructor:** `constructor(private readonly prisma: PrismaService) {}`
- **Methods:**
  ```typescript
  async setOwnership(userId: string, coinId: string, owned: boolean): Promise<SetOwnershipResponse>
  async findAll(userId: string, query: FindCollectionQueryDto): Promise<OwnershipItem[]>
  ```
- **`setOwnership` — exact Prisma calls the Tester's mock must cover:**
  1. If `owned === true`:
     - `const row = await this.prisma.ownership.upsert({ where: { userId_coinId: { userId, coinId } }, create: { userId, coinId }, update: {} });` inside a `try` block.
     - On success: `return { coinId, owned: true, ownedAt: row.ownedAt };`
     - On a thrown error where `err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2003'`: `throw new NotFoundException('Coin not found');`
     - Any other thrown error: rethrown unchanged (`throw err;`).
     - `this.prisma.ownership.deleteMany` is NEVER called in this branch.
  2. If `owned === false`:
     - `await this.prisma.ownership.deleteMany({ where: { userId, coinId } });`
     - `return { coinId, owned: false, ownedAt: null };`
     - `this.prisma.ownership.upsert` is NEVER called in this branch. No `try`/`catch` around this call.
- **`findAll` — exact Prisma call the Tester's mock must cover:**
  ```typescript
  return this.prisma.ownership.findMany({
    where: {
      userId,
      coin: {
        ...(query.country !== undefined ? { country: query.country } : {}),
        ...(query.year !== undefined ? { year: query.year } : {}),
      },
    },
    include: { coin: true },
    orderBy: { ownedAt: 'desc' },
  });
  ```
  With no `country`/`year` on `query`, the call's `where.coin` is `{}` (present, empty) — assert on `where.userId` and the presence/absence of `where.coin.country`/`where.coin.year` keys per test case, not on `where.coin` being `undefined`.
- **Dependencies:** `PrismaService` (`../prisma/prisma.service`), `Prisma` namespace + `PrismaClientKnownRequestError` from `@prisma/client` (already a dependency, same import used in `apps/api/src/auth/auth.service.ts`), `NotFoundException` from `@nestjs/common`, `OwnershipItem`/`SetOwnershipResponse` from `@coin-collector/shared`, `FindCollectionQueryDto`.

### Controller: CollectionController
- **File:** `apps/api/src/collection/collection.controller.ts`
- **Export:** `export class CollectionController`
- **Constructor:** `constructor(private readonly collectionService: CollectionService) {}`
- **Handlers:**
  ```typescript
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser, @Query() query: FindCollectionQueryDto): Promise<OwnershipItem[]>

  @Patch(':coinId')
  setOwnership(@CurrentUser() user: AuthenticatedUser, @Param('coinId', ParseUUIDPipe) coinId: string, @Body() dto: SetOwnershipDto): Promise<SetOwnershipResponse>
  ```
- Neither handler carries `@Public()`. `findAll` delegates to `collectionService.findAll(user.userId, query)`, returning the result unchanged. `setOwnership` delegates to `collectionService.setOwnership(user.userId, coinId, dto.owned)`, returning the result unchanged.
- **Dependencies:** `CollectionService`, `CurrentUser` (`../auth/decorators/current-user.decorator`), `AuthenticatedUser` (`../auth/strategies/jwt.strategy`), `SetOwnershipDto`, `FindCollectionQueryDto`, `OwnershipItem`/`SetOwnershipResponse` from `@coin-collector/shared`.

### Module: CollectionModule
- **File:** `apps/api/src/collection/collection.module.ts`
- **Export:** `export class CollectionModule`
- **Definition:** `@Module({ controllers: [CollectionController], providers: [CollectionService] })` — no explicit `PrismaModule` import (it's `@Global()`), matching `SetsModule`'s existing shape exactly.

### `apps/api/src/app.module.ts` — required change
- Add `import { CollectionModule } from './collection/collection.module';`
- Add `CollectionModule` to the `imports` array, after `SetsModule`.

### Service: SetsService — new method (existing methods/constructor unchanged)
- **File:** `apps/api/src/sets/sets.service.ts` (already exists)
- **New method:**
  ```typescript
  async getGaps(callerId: string, setId: string): Promise<GapViewResponse>
  ```
- **Exact Prisma call the Tester's mock must cover:**
  ```typescript
  const set = await this.prisma.userSet.findUnique({
    where: { id: setId },
    include: {
      coins: {
        orderBy: { position: 'asc' },
        include: { coin: { include: { ownerships: { where: { userId: callerId } } } } },
      },
    },
  });
  ```
  If `set` is `null` (or `undefined`, matching this service's existing convention for `findCanonicalById`/`findPublicById`): `throw new NotFoundException('Set not found');` — no `getOwnedSetOrThrow` call anywhere in this method, no `ForbiddenException` import needed here (already imported in the file for other methods; not used by this one).
  Otherwise, computed purely in JS from `set.coins` (no further Prisma calls):
  ```typescript
  const totalCount = set.coins.length;
  const slots = set.coins.map((usc) => ({
    id: usc.id,
    position: usc.position,
    coin: usc.coin,
    owned: usc.coin.ownerships.length > 0,
  }));
  const ownedCount = slots.filter((s) => s.owned).length;
  const completionPercent = totalCount === 0 ? 0 : Math.round((ownedCount / totalCount) * 100);
  return { setId, ownedCount, totalCount, completionPercent, slots };
  ```
  In the mocked-Prisma unit tests, `mockPrismaService.userSet.findUnique` resolves a fixture whose `coins[].coin.ownerships` array is `[]` (not owned by caller) or has one entry (owned by caller) — the mock stands in for the `where: { userId: callerId }` filter already having been applied at the DB layer, so the test asserts the call's `include` argument shape (down to the `ownerships.where.userId` value) separately from asserting the computed `owned`/`ownedCount`/`completionPercent` output.
- **Dependencies:** `NotFoundException` (already imported), `GapViewResponse`/`GapSlot` from `@coin-collector/shared` (new import).

### Controller: SetsController — new handler (existing handlers/constructor unchanged)
- **File:** `apps/api/src/sets/sets.controller.ts` (already exists)
- **Required new imports:** `GapViewResponse` added to the existing `@coin-collector/shared` type-only import block.
- **New handler**, declared as the last method in the class (after `remove`):
  ```typescript
  @Get(':id/gaps')
  @ApiOperation({ summary: 'Coin list with owned/not-owned status and completion %, computed against the caller — not owner-restricted' })
  @ApiOkResponse({ description: 'Gap view for the requested set' })
  getGaps(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GapViewResponse> {
    return this.setsService.getGaps(user.userId, id);
  }
  ```
  No `@Public()`. Delegates `user.userId` as the caller id, returns the service's result unchanged — same delegation pattern as every other handler in this controller.
- **Dependencies:** `SetsService` (existing constructor injection, unchanged).

### Test file: `apps/api/src/collection/dto/set-ownership.dto.spec.ts`
- Mirrors `create-set.dto.spec.ts`'s pattern: `plainToInstance(SetOwnershipDto, body)` + `validate(instance)`.
- Cases: `{ owned: true }` passes (0 errors); `{ owned: false }` passes; `{ owned: 'true' }` fails with an error on `owned` (string, not boolean — note `class-transformer` does not coerce here since there is no `@Type(() => Boolean)`); `{}` (missing `owned`) fails with an error on `owned`.

### Test file: `apps/api/src/collection/dto/find-collection-query.dto.spec.ts`
- Same pattern. Cases: `{}` passes (both fields optional); `{ country: 'USA' }` passes; `{ year: '1943' }` (string, as query params always arrive) passes and `instance.year` is the number `1943` after `@Type(() => Number)`; `{ country: 'USA', year: '1943' }` passes; `{ year: 'not-a-number' }` fails with an error on `year`.

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. `PATCH /collection/:coinId` in new `CollectionModule`, auth required, `ParseUUIDPipe` on `:coinId` | `CollectionController.setOwnership` + `CollectionModule` registered in `AppModule` |
| 2. Body `{ owned: boolean }` validated with `@IsBoolean()` | `SetOwnershipDto` |
| 3. `owned: true` → upsert, no-op on already-owned (including `ownedAt` unchanged) | `CollectionService.setOwnership` upsert branch, `update: {}` |
| 4. `owned: false` → `deleteMany`, no error on already-absent | `CollectionService.setOwnership` deleteMany branch |
| 5. Response shape `{ coinId, owned, ownedAt }` | `SetOwnershipResponse` + both branches' return statements |
| 6. Unknown `coinId` → 404, not raw FK 500 | `CollectionService.setOwnership`'s `P2003` → `NotFoundException` mapping |
| 7. `GET /collection`, auth required, unpaginated, `country`/`year` filters | `CollectionController.findAll` + `FindCollectionQueryDto` + `CollectionService.findAll` |
| 8. Filter via relation through `coin` | `CollectionService.findAll`'s `where.coin` shape |
| 9. `GET /sets/:id/gaps`, auth required, not owner-restricted, 404 only on unknown set | `SetsService.getGaps` (no `getOwnedSetOrThrow` call, no `ForbiddenException` branch) |
| 10. Gap computation is one query, no N+1 | `SetsService.getGaps`'s single `userSet.findUnique` with nested `include` |
| 11. `ownedCount`/`totalCount`/`completionPercent`, zero-division guarded | `SetsService.getGaps`'s computed block |
| 12. New shared types added additively | Interface Contract §Shared types — pure additions, no edits to any existing export |
| 13. `typecheck`/`build`/`test`/`lint` all clean | Coder runs all four before completion; sandbox re-verifies `test`. Coder must rebuild `packages/shared` (`pnpm --filter @coin-collector/shared build`) after editing its `src/index.ts`, since `dist/` is gitignored and not auto-built (memory.md gotcha, run_20260720_070901) |
| 14. `docs/backlog_week2.md` 4.1–4.3 checked off with deviation notes | Coder's final step |
| 15. Manual-pass verification (idempotency against real DB, filter checks, set-deletion/ownership isolation, clone-lineage isolation, gap-view-on-non-owned-set, 401 checks) | Explicitly out-of-band — see Risks below. Not gated by the automated pipeline's PASS/FAIL verdict; `docs/backlog_week2.md` 4.4–4.5 stay unchecked with a pending-manual-pass note per this plan's step 10 |

## Risks and open questions

- **Criterion #15 (all of PRD's "Manual pass" acceptance criterion, plus backlog tasks 4.4–4.5) is explicitly not covered by the automated Coder/sandbox pipeline.** The sandbox worktree has no real DB credentials, and this repo's own backlog labels 4.4/4.5 "Manual pass" rather than automated tests — consistent with `memory.md`'s existing gotcha on this exact point (run_20260720_121716: "treat that as an out-of-band manual step... document the deferral explicitly in the backlog checkboxes... rather than marking them done on the strength of code + mocked-Prisma unit tests alone"). This plan's mocked-Prisma unit tests cover the underlying logic (upsert/deleteMany argument shapes, `ownedAt` preservation, 404 mapping, gap computation math, `@Public()` absence) at the mock level; they cannot observe real Postgres FK/cascade/`SetNull` behavior or real HTTP 401s. If the user wants the live-DB manual pass actually executed, that is a separate step after this pipeline run completes, against the real dev DB, with cleanup — not something this run's PASS verdict claims to have done.
- **`SetsService.getGaps`'s nested `include` shape is asserted at the mock level, not against a real Prisma Client type** — same class of gap already noted in `run_20260720_070901/plan.md` for `findCanonicalById`/`findPublicById`: a genuine Prisma schema/relation-name typo (e.g. `ownerships` misspelled) would only be caught by `pnpm --filter api build`/`typecheck` against the real generated client, not by the mocked unit test.
- **`ownedAt`-preservation decision (criterion #3):** the task prompt left this as an open question ("decide and verify either way"). This plan decides in favor of preservation (`update: {}` leaves the row untouched on conflict) because `ownedAt` is documented in `system-design_v2.md` §4.1 as "when it was marked owned" — a re-upsert of an already-owned coin isn't a new marking event, so resetting the timestamp would be semantically wrong, not just an implementation detail. Flagged here in case the manual-pass verification (out of scope for this run, see above) surfaces a reason to reconsider.
- **404-vs-500 decision on unknown `coinId` (criterion #6):** also left open by the task prompt. This plan follows the existing `P2002`→409 precedent in `AuthService.register` and extends it to `P2003`→404 for consistency, rather than leaving a raw Prisma error to surface as a 500. No other code in this repo currently maps `P2003` specifically; this is a new but narrow precedent, scoped to this one call site.
