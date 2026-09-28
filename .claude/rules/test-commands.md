# Running tests in a fresh checkout or worktree

A fresh `git clone` / `git worktree add` + `pnpm install` is missing two generated things that the test suites need. Set them up before trusting a red result:

- **`packages/shared` build output.** `dist/` is gitignored and nothing builds it on install. `apps/web` tests and every `apps/api` typecheck/build resolve `@coin-collector/shared` through it. (`apps/api`'s Jest maps straight to `src`, so api tests alone don't need it.) Without it: `Failed to resolve entry for package "@coin-collector/shared"` (web) or `TS2305: has no exported member` (api typecheck). Fix: `pnpm --filter @coin-collector/shared build`. Also rebuild it after any edit to `packages/shared/src`.
- **Prisma client.** `apps/api/.env` (`DATABASE_URL`) is gitignored, so a worktree lacks it, and `prisma generate`'s postinstall silently produces an incomplete client. Symptom: `TypeError: Prisma.PrismaClientKnownRequestError is not a constructor` in suites that construct real Prisma errors (`collection.service.spec.ts`, `catalog.service.spec.ts`, `auth` register P2002 handling). It looks like a logic bug but isn't. Fix: `pnpm --filter api exec prisma generate`.

The scope is the whole test **command**, not the current task: `pnpm --filter api test` runs every `apps/api` suite, so the Prisma step is needed even if your change never touches Prisma errors.

Known-good commands for a fresh worktree:

```bash
# api
pnpm --filter api exec prisma generate && pnpm --filter api test
# web
pnpm --filter @coin-collector/shared build && pnpm --filter web test
```

Live-DB work (running a seed or migration for real, psql spot checks against the Neon dev DB that Render also uses) is a manual step. Automated runs have no DB credentials. Leave those backlog items unchecked with a "pending manual pass" note instead of marking them done on the strength of mocked-Prisma unit tests.
