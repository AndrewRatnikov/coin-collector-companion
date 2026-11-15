# Every Render deploy applies pending migrations with `prisma migrate deploy` inside `buildCommand`

- **Status:** Accepted
- **Date:** 2026-11-15
- **Source:** orchestrator run `run_20261115_193432` (growth backlog 0.3, make the Render deploy apply migrations; the user's task fixed the step and its position)
- **Code:** `render.yaml`, `apps/web/src/lib/render-build-migrations.test.ts`

## Context

Render's build used to skip migrations, so they were applied by hand with `prisma migrate deploy` before deploying code that needed them. When that was forgotten, code shipped ahead of its schema and `GET /catalog` and login returned 500; typecheck, build and unit tests do not catch it. The API service is on Render's free plan, which has no `preDeployCommand`, the place Render intends for this.

## Decision

`buildCommand` in `render.yaml` gains one `&&`-joined step, `pnpm --filter api exec prisma migrate deploy`, directly after `pnpm --filter api exec prisma generate` and before `pnpm --filter @coin-collector/shared build` and `pnpm --filter api build`. Every step is joined with `&&`, so a failed migration fails the build and Render keeps serving the previous deploy. `DATABASE_URL` (already a `sync: false` env var) is what `apps/api/prisma.config.ts` reads during the build. No `preDeployCommand` is used, and `startCommand` stays `node dist/main`.

The position (right after generate, before any build) was fixed by the task. A guard test, `apps/web/src/lib/render-build-migrations.test.ts`, reads `render.yaml` as text and pins the step, its position, the absence of `;` and `||`, and the absence of `preDeployCommand`.

## Alternatives considered

- **`preDeployCommand`:** the intended mechanism, but not available on the free plan.
- **Migrate in `startCommand` before `node dist/main`:** runs on every instance start, including each free-tier wake-up, slows cold start against the health check, and a failure crash-loops the new deploy instead of failing the build.
- **A CI job that migrates production:** puts the production database URL in GitHub and decouples the migration from the deploy.
- **Keep migrating by hand:** the status quo, which already caused the 500s above.
- **Migrate as the last build step, after the API build:** a TypeScript build failure would then never leave the schema migrated under the old code. Not chosen because the task fixed the position, and migrations must be backward compatible with the running code anyway.

## Consequences

- A forgotten migration can no longer go live with its code. With nothing pending, `migrate deploy` is a no-op, so ordinary deploys are unaffected.
- The build now needs `DATABASE_URL` and network access to Neon.
- Migrations run while the old code is still serving, before the new code starts, so destructive or non-backward-compatible changes still need expand/contract (add, ship, remove in a later migration).
- If a later build step fails, the schema stays migrated under the old code. Under expand/contract this is harmless.
- A Render rollback does not undo a migration.
- Risk: Neon's pooled URL may not support Prisma's advisory lock (P1002 timeout). If so, the migrate step needs a direct (non-pooled) connection string, as a follow-up change.
- The first real deploy with this step is unverified: the run had no database credentials. Backlog item 0.3 stays unticked with a pending-manual-pass note in `docs/backlog_growth.md`.
- The "shadow database" warning (never pass the production URL as `--shadow-database-url`) is unchanged in `CLAUDE.md` and `README.md`.
