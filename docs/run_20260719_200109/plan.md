# Technical Plan: SetsModule — create/rename/delete/list surface (Week 2, Day 1)

**Run:** run_20260719_200109
**Date:** 2026-07-19

## Summary

Add a new `SetsModule` to `apps/api/src/sets/`, following the existing `CatalogModule`'s structure exactly (`*.module.ts`/`*.controller.ts`/`*.service.ts`/`dto/*.ts`). It exposes `GET /sets`, `POST /sets`, `PATCH /sets/:id`, `DELETE /sets/:id` — all requiring auth via the existing global `JwtAuthGuard` (no `@Public()` anywhere in this controller). New response/request shapes are added to `packages/shared/src/index.ts` alongside the existing `CatalogCoin`/`PaginatedResponse` exports, and `SetsModule` is registered in `app.module.ts`.

## Approach

1. **Shared types first** (`packages/shared/src/index.ts`): add `UserSetSummary` (the flat `UserSet` row shape — no coins, since this task never returns coin lists), `CloneFromRequest` (`{ type: 'canonical' | 'user'; id: string }`), and `CreateSetRequestBody` (`{ name: string; cloneFrom?: CloneFromRequest }`). Append below the existing exports; do not touch `CatalogCoin`/`PaginatedResponse`.
2. **DTOs** (`apps/api/src/sets/dto/`): `CloneFromDto` (nested, validated with `@IsIn(['canonical','user'])` + `@IsUUID()`), `CreateSetDto` (`name` + optional nested `cloneFrom` via `@ValidateNested()` + `@Type(() => CloneFromDto)` from `class-transformer` — same pattern already used for numeric coercion in `FindCatalogQueryDto`), `UpdateSetDto` (`name` only). Follow `RegisterDto`/`FindCatalogQueryDto`'s existing style: `@ApiProperty`/`@ApiPropertyOptional` + class-validator decorators, definite-assignment `!` on required fields.
3. **SetsService** (`apps/api/src/sets/sets.service.ts`): four public methods — `findAllForUser`, `create`, `update`, `remove` — plus a private `getOwnedSetOrThrow` helper shared by `update`/`remove` for the 404-vs-403 ownership check. `create`'s clone branch (`cloneFrom` present) reads the source rows and writes the new `UserSet` + `UserSetCoin` rows **inside one `prisma.$transaction(async (tx) => ...)` callback**, using the callback's `tx` argument for every read/write in that branch — never `this.prisma` directly inside the callback, since that would break real transactional atomicity even though a unit-test mock can't distinguish the two (see Risks). Exactly one of `clonedFromCanonicalId`/`clonedFromUserSetId` is set by a plain ternary keyed on `dto.cloneFrom.type` — this is the "handler-level invariant" enforcement the PRD requires; there is no separate runtime assertion needed because the DTO shape structurally cannot represent both at once.
4. **SetsController** (`apps/api/src/sets/sets.controller.ts`): thin — each handler pulls `@CurrentUser()` and delegates straight to the service, mirroring `CatalogController`'s delegation style. `ParseUUIDPipe` on every `:id` param from the start (PRD/backlog 1.3, ahead of the Day 2 route-ordering concern). No `@Public()` on any handler — the module relies entirely on the existing global `JwtAuthGuard` default-deny.
5. **SetsModule** (`apps/api/src/sets/sets.module.ts`): `controllers: [SetsController]`, `providers: [SetsService]` — no explicit `PrismaModule` import needed; `PrismaModule` is `@Global()` (confirmed in `apps/api/src/prisma/prisma.module.ts`) and `CatalogModule` already relies on that same global registration without importing it itself.
6. **app.module.ts**: add `import { SetsModule } from './sets/sets.module';` and add `SetsModule` to the `imports` array, directly after `CatalogModule`.
7. **Manual verification** (task 1.4, executed by whoever runs this plan after the automated pipeline passes — not by the Tester/Coder agents): register two throwaway users via `POST /auth/register`; user A creates/renames/deletes a blank set and confirms it's gone from a follow-up `GET /sets`; hand-seed one throwaway `CanonicalSet` + a couple of `CanonicalSetCoin` rows referencing real Week-1-imported `Coin` rows (Prisma Studio/psql); user A clones it via `POST /sets` and the resulting `UserSetCoin` rows/positions/`clonedFromCanonicalId` are checked directly in the DB; user B gets 403 (not 404) on `PATCH`/`DELETE` against user A's set; an unauthenticated `GET /sets` gets 401; every throwaway row created during this pass is deleted afterward since this DB is also what Render points at in prod.

**Edge cases the implementation must handle:**
- Blank creation (`cloneFrom` absent) never touches `UserSetCoin` and leaves both clone-lineage FKs `null`.
- Clone-from-user's source lookup has **no ownership/visibility filter** — `userSetCoin.findMany({ where: { userSetId: id } })` against *any* set id in the DB, not scoped to the caller.
- A clone source with zero coin rows (e.g. an empty canonical set) still succeeds — creates the `UserSet` row with zero `UserSetCoin` rows, not an error.
- `getOwnedSetOrThrow` must check existence before ownership — 404 when the row doesn't exist at all, 403 only when it exists and `userId` differs. Order matters: never leak a 403 for a nonexistent id.
- `DELETE /sets/:id`'s handler and `SetsService.remove` must never reference `prisma.ownership` in any form — this is a structural requirement (PRD criteria 9–10), not just a behavioral one, since `Ownership` has no FK to `UserSet` at all and relies on the schema's `onDelete: Cascade` on `UserSetCoin.userSetId` alone.

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| `packages/shared/src/index.ts` | MODIFY | Add `UserSetSummary`, `CloneFromRequest`, `CreateSetRequestBody` exports |
| `apps/api/src/sets/dto/clone-from.dto.ts` | CREATE | Nested `cloneFrom` validation (`type` + `id`) |
| `apps/api/src/sets/dto/create-set.dto.ts` | CREATE | `POST /sets` body DTO |
| `apps/api/src/sets/dto/update-set.dto.ts` | CREATE | `PATCH /sets/:id` body DTO |
| `apps/api/src/sets/sets.service.ts` | CREATE | List/create/update/remove + ownership check + clone transaction |
| `apps/api/src/sets/sets.controller.ts` | CREATE | Route handlers, all auth-required |
| `apps/api/src/sets/sets.module.ts` | CREATE | Wires controller + service |
| `apps/api/src/app.module.ts` | MODIFY | Register `SetsModule` in `imports` |

## Interface Contract

This section is the single source of truth for all names. The Tester and Coder read this; neither invents anything independently.

### Shared types: `packages/shared/src/index.ts`

Add below the existing `PaginatedResponse<T>` export (do not remove/alter `CatalogCoin`/`PaginatedResponse`):

```typescript
export interface UserSetSummary {
  id: string;
  userId: string;
  name: string;
  clonedFromCanonicalId: string | null;
  clonedFromUserSetId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CloneFromRequest {
  type: 'canonical' | 'user';
  id: string;
}

export interface CreateSetRequestBody {
  name: string;
  cloneFrom?: CloneFromRequest;
}
```

### DTO: `CloneFromDto`
- **File:** `apps/api/src/sets/dto/clone-from.dto.ts`
- **Export:** `export class CloneFromDto`
- **Fields:**
  ```typescript
  class CloneFromDto {
    type: 'canonical' | 'user';  // @IsIn(['canonical', 'user'])
    id: string;                  // @IsUUID()
  }
  ```
- **Dependencies:** `class-validator` (`IsIn`, `IsUUID`), `@nestjs/swagger` (`ApiProperty`)

### DTO: `CreateSetDto`
- **File:** `apps/api/src/sets/dto/create-set.dto.ts`
- **Export:** `export class CreateSetDto`
- **Fields:**
  ```typescript
  class CreateSetDto {
    name: string;              // @IsString() @IsNotEmpty()
    cloneFrom?: CloneFromDto;  // @IsOptional() @ValidateNested() @Type(() => CloneFromDto)
  }
  ```
- **Dependencies:** `class-validator` (`IsString`, `IsNotEmpty`, `IsOptional`, `ValidateNested`), `class-transformer` (`Type`), `./clone-from.dto`, `@nestjs/swagger`

### DTO: `UpdateSetDto`
- **File:** `apps/api/src/sets/dto/update-set.dto.ts`
- **Export:** `export class UpdateSetDto`
- **Fields:**
  ```typescript
  class UpdateSetDto {
    name: string;  // @IsString() @IsNotEmpty()
  }
  ```
- **Dependencies:** `class-validator` (`IsString`, `IsNotEmpty`), `@nestjs/swagger`

### Service: `SetsService`
- **File:** `apps/api/src/sets/sets.service.ts`
- **Export:** `export class SetsService`
- **Constructor:** `constructor(private readonly prisma: PrismaService)`
- **Methods:**
  ```typescript
  findAllForUser(userId: string): Promise<UserSetSummary[]>
  create(userId: string, dto: CreateSetDto): Promise<UserSetSummary>
  update(userId: string, id: string, dto: UpdateSetDto): Promise<UserSetSummary>
  remove(userId: string, id: string): Promise<void>
  // private helper — not part of the public contract, but its throw behavior is:
  // throws NotFoundException when no UserSet with `id` exists
  // throws ForbiddenException when a UserSet exists but userId !== the row's userId
  ```
- **Behavior contract (what the Tester's mocks must exercise):**
  - `findAllForUser(userId)` → `prisma.userSet.findMany({ where: { userId }, ... })`
  - `create(userId, { name })` (no `cloneFrom`) → `prisma.userSet.create({ data: { userId, name, ... } })`, **no** call to `prisma.userSetCoin.createMany` and **no** call to `prisma.$transaction`
  - `create(userId, { name, cloneFrom: { type: 'canonical', id } })` → wrapped in `prisma.$transaction`; inside it, reads `canonicalSetCoin.findMany({ where: { canonicalSetId: id } })`, creates the `UserSet` with `clonedFromCanonicalId: id` and `clonedFromUserSetId: null`, then `userSetCoin.createMany` with each row's `coinId`/`position` copied verbatim (not renumbered) from the source rows
  - `create(userId, { name, cloneFrom: { type: 'user', id } })` → same transaction shape, sourcing from `userSetCoin.findMany({ where: { userSetId: id } })` (**no** filter on the source set's owner), creates the `UserSet` with `clonedFromUserSetId: id` and `clonedFromCanonicalId: null`
  - `update(userId, id, dto)` → looks up the set by `id` first; throws `NotFoundException` if absent; throws `ForbiddenException` if `set.userId !== userId`; otherwise `prisma.userSet.update({ where: { id }, data: { name: dto.name } })`
  - `remove(userId, id)` → same 404/403 lookup as `update`, then `prisma.userSet.delete({ where: { id } })`; **must never** call anything on `prisma.ownership` in any code path
- **Recommended Prisma mock shape for `sets.service.spec.ts`** (so `$transaction`'s callback receives a usable mock without a separate `tx` object):
  ```typescript
  const mockPrismaService = {
    userSet: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() },
    userSetCoin: { findMany: jest.fn(), createMany: jest.fn() },
    canonicalSetCoin: { findMany: jest.fn() },
    $transaction: jest.fn((callback) => callback(mockPrismaService)),
  };
  ```
- **Dependencies:** `@nestjs/common` (`Injectable`, `NotFoundException`, `ForbiddenException`), `../prisma/prisma.service` (`PrismaService`), `@coin-collector/shared` (`UserSetSummary`), `./dto/create-set.dto`, `./dto/update-set.dto`

### Controller: `SetsController`
- **File:** `apps/api/src/sets/sets.controller.ts`
- **Export:** `export class SetsController`
- **Decorators:** `@ApiTags('sets')`, `@ApiBearerAuth()`, `@Controller('sets')` — **no `@Public()` anywhere**
- **Constructor:** `constructor(private readonly setsService: SetsService)`
- **Handlers:**
  ```typescript
  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser): Promise<UserSetSummary[]>

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateSetDto): Promise<UserSetSummary>

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSetDto,
  ): Promise<UserSetSummary>

  @Delete(':id')
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void>
  ```
  Each handler delegates to the matching `SetsService` method unchanged (same delegation style as `CatalogController.findAll`/`findOne`), passing `user.userId` as the first arg.
- **Swagger:** `@ApiOperation({ summary: ... })` + `@ApiOkResponse({ description: ... })` on every handler.
- **Dependencies:** `@nestjs/common` (`Controller`, `Get`, `Post`, `Patch`, `Delete`, `Body`, `Param`, `ParseUUIDPipe`), `@nestjs/swagger`, `../auth/decorators/current-user.decorator` (`CurrentUser`), `../auth/strategies/jwt.strategy` (`AuthenticatedUser` type), `@coin-collector/shared` (`UserSetSummary`), `./sets.service`, `./dto/create-set.dto`, `./dto/update-set.dto`

### Module: `SetsModule`
- **File:** `apps/api/src/sets/sets.module.ts`
- **Export:** `export class SetsModule`
- **Shape:** `@Module({ controllers: [SetsController], providers: [SetsService] })` — no `imports` array needed (see Approach step 5)

### Modification: `apps/api/src/app.module.ts`
- Add `import { SetsModule } from './sets/sets.module';` alongside the existing `CatalogModule` import
- Add `SetsModule` to the `imports` array, immediately after `CatalogModule`

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. `GET /sets` requires auth, returns only caller's own sets, unpaginated | `SetsController.findAll` (no `@Public()`), `SetsService.findAllForUser` scoping `where: { userId }` |
| 2. `POST /sets` accepts exactly 3 shapes, validated (400 on bad `cloneFrom.type`/non-UUID `id`) | `CreateSetDto` + nested `CloneFromDto` with `@IsIn`/`@IsUUID`, global `ValidationPipe({ whitelist: true, transform: true })` already in `main.ts` |
| 3. Blank creation → empty set, both clone FKs null | `SetsService.create`'s no-`cloneFrom` branch |
| 4. Clone-from-canonical copies `CanonicalSetCoin` rows verbatim, sets `clonedFromCanonicalId` | `SetsService.create`'s `type === 'canonical'` transaction branch |
| 5. Clone-from-user copies from any `UserSet`, no source ownership check, sets `clonedFromUserSetId` | `SetsService.create`'s `type === 'user'` transaction branch — no `userId` filter on the source query |
| 6. At most one clone-lineage FK ever set | Ternary assignment keyed on `dto.cloneFrom.type` (structural, not a runtime assertion) |
| 7. Clone create+copy in one `prisma.$transaction` | `SetsService.create`'s transaction wrapping both the `userSet.create` and `userSetCoin.createMany` calls |
| 8. `PATCH /sets/:id`: rename only, `ParseUUIDPipe`, 404 unknown / 403 foreign | `SetsController.update` + `SetsService.update` + `getOwnedSetOrThrow` |
| 9. `DELETE /sets/:id`: same 404/403, deletes row, cascade cleans `UserSetCoin`, never touches `Ownership` | `SetsController.remove` + `SetsService.remove` + `getOwnedSetOrThrow`; no `prisma.ownership.*` call anywhere in `sets.service.ts` |
| 10. Owned coin survives set deletion (structural, verified in manual pass) | Same as above — no code path from `remove()` to `Ownership` |
| 11. New shared shapes added to `packages/shared` without touching existing exports | `UserSetSummary`/`CloneFromRequest`/`CreateSetRequestBody` appended to `packages/shared/src/index.ts` |
| 12. Swagger decorators on every route | `@ApiTags`/`@ApiOperation`/`@ApiOkResponse` on all four `SetsController` handlers |
| 13. `SetsModule` registered in `app.module.ts` | Approach step 6 |
| 14. Manual verification pass executed and cleaned up | Executed post-pipeline per Approach step 7 (outside the automated Tester/Coder loop — see Risks) |
| 15. `typecheck`/`build`/`test`/`lint` all clean | Automated tests (`sets.controller.spec.ts`, `sets.service.spec.ts`) + Stage 6 sandbox run against `pnpm --filter api test`; `typecheck`/`build`/`lint` are the human/pipeline-runner's responsibility after Stage 7 (see Risks) |

## Risks and open questions

- **Manual verification (criterion 14) and `typecheck`/`build`/`lint` (criterion 15) are outside this pipeline's automated stages.** The pipeline's Tester/Coder loop produces and verifies Jest unit tests only (`pnpm --filter api test`, confirmed as the real test command — see corrected `repo-digest.md`). Running the live manual pass against a real (dev/prod-shared) database, and the separate `typecheck`/`build`/`lint` commands, requires a human or a follow-up session with real DB/shell access beyond this run's sandboxed test execution — flagging this explicitly rather than silently claiming full PRD coverage from the automated stages alone.
- **`$transaction` mock cannot distinguish `tx.x` from `this.prisma.x` calls inside the callback** (both resolve to the same mock object in the recommended test setup). This is a known limitation of unit-level Prisma transaction testing — the Coder must still use the callback's `tx` argument for real-world atomicity; this is a self-review requirement rather than something the automated test suite can enforce.
- **DTO validation of `cloneFrom.type`** relies on `@IsIn(['canonical', 'user'])` rather than a TypeScript union alone, since `class-validator` needs a runtime check independent of the type system to reject bad request bodies with 400 (a plain union-typed field with no validator would pass anything through).
- **No new dependencies** — `class-validator`, `class-transformer`, `@nestjs/swagger`, `@prisma/client`, `@nestjs/testing`, `jest`, `supertest` are all already present in `apps/api/package.json`.
