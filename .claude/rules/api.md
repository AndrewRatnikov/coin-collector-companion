---
paths:
  - "apps/api/**"
---

# apps/api (NestJS + Prisma) gotchas

## DTOs and validation
- **`@Transform` does not run when the key is absent** from the request body (`ValidationPipe({ whitelist: true, transform: true })`). It only runs when the key is present, even as `null`. An optional field that needs a normalized default when omitted (e.g. `mintMark` / `variety` → `''`) must use a class-field initializer (`mintMark: string = '';`), not `@IsOptional()` + `@Transform` alone. When unsure, verify with a throwaway `plainToInstance` repro against the installed `class-transformer`.
- **`@IsUUID()` test fixtures must be real UUIDs.** `'11111111-1111-1111-1111-111111111111'` fails the RFC 4122 variant check. Use something like `'3fa85f64-5717-4562-b3fc-2c963f66afa6'`.

## Auth
- **Optional-auth routes** (first used by `GET /catalog?submittedByMe=true`): a route-level guard extending `AuthGuard('jwt')` that overrides only `handleRequest` to return `user ?? undefined` instead of throwing. Apply it with `@UseGuards(OptionalGuard)` alongside the route's `@Public()`, and never touch the global `APP_GUARD`. Pair it with `@OptionalCurrentUser()`, typed `AuthenticatedUser | undefined`; don't widen `@CurrentUser()`. Reuse this shape for any future optional-auth route.

## Jest
- **Jest `rootDir` is `src`**, and `"roots"` also includes `<rootDir>/../scripts`. A `*.spec.ts` in any other top-level folder under `apps/api/` is silently never run: a false-pass risk. Add that folder to `roots` when you put specs there.
- **Fresh-worktree test failures:** see `.claude/rules/test-commands.md` (Prisma client + shared build).
- **Run api tests through the package scripts** (`pnpm --filter api test` / `test:e2e`). Since NestJS 12 the `@nestjs/*` packages are ESM-only, and Jest's CommonJS runtime can load them only with Node's `--experimental-vm-modules` flag, which the scripts pass (`node --experimental-vm-modules ./node_modules/jest/bin/jest.js`). A bare `jest` or `pnpm exec jest` fails most suites with "Must use import to load ES Module": an environment error, not a broken test. IDE runners need `NODE_OPTIONS=--experimental-vm-modules`.
