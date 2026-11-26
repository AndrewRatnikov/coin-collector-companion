# The catalog import diffs each fixture file against the database in memory and writes only the difference in one transaction

- **Status:** Accepted. [2026-11-26-catalog-import-leaves-non-approved-coins-alone-as-conflicts](2026-11-26-catalog-import-leaves-non-approved-coins-alone-as-conflicts.md) amends it: a non-approved coin on a fixture key is a conflict the import never writes, the log line adds a conflicts count, and the run exits 1 when it finds one
- **Date:** 2026-11-21
- **Source:** orchestrator run `run_20261121_173317` (batch the catalog import; `docs/catalog-expansion-research.md` "Before adding coins" item 3 left the batching style open)
- **Code:** `scripts/import-catalog/import-coins.ts`, `scripts/import-catalog/lib/plan.ts`, `apps/api/scripts/import-catalog-plan.spec.ts`, `apps/api/tsconfig.json`

## Context

The import did a `findUnique`, then a `create` or `update`, for every coin: at least two round trips per row to Neon. The catalog is about to grow by thousands of rows, and a re-run on an already-imported database rewrote every row. The task also required that re-runs write nothing, that coins are never deleted, and that files are still processed one at a time, stopping on the first bad file.

## Decision

Per fixture file, `importFixtureFile` builds the desired rows as before (`sanitizeIdentityField` for `mintMark`/`variety`, `lib/image.ts` and `lib/specs.ts` unchanged), reads every existing coin for the file's `(country, denomination)` with one `findMany` and an explicit select of the 16 columns it needs, and passes both lists to the pure function `planCoinImport` in `scripts/import-catalog/lib/plan.ts`. The planner has no I/O and no Prisma import. It returns `toCreate`, `toUpdate` (existing id plus only the changed fields among `name`, the image fields and the spec fields) and `unchanged`.

- Rows match on the full natural key `(country, denomination, year, mintMark, variety)`. `undefined` and `null` compare equal; a changed value that becomes null is sent as `null`, not `undefined`, because Prisma ignores `undefined`.
- Duplicate keys inside one file collapse: the last occurrence's values win.
- Existing rows absent from the fixture are never touched. No delete exists in the script.
- If there is nothing to create or update, no transaction is opened.
- Otherwise one interactive `prisma.$transaction` per file runs `createMany({ skipDuplicates: true })` in chunks of 1000 (`CREATE_CHUNK_SIZE`) and one `update` per changed row, all through `tx`. Options: `timeout` 600,000 ms, `maxWait` 30,000 ms. An error rolls back the file and reaches `main().catch`, which exits 1, so later files do not run.
- The log line is `created, updated, unchanged, total`. `created` is the real `createMany` count; `total` is the number of distinct keys in the file.

The planner is tested from `apps/api/scripts/import-catalog-plan.spec.ts`, which runs under `pnpm --filter api test`. To keep the api typecheck valid for a spec importing a file outside `apps/api`, `rootDir` in `apps/api/tsconfig.json` is now `../..`; the build keeps `./src` through `tsconfig.build.json`.

## Alternatives considered

- **One raw-SQL `INSERT ... ON CONFLICT DO UPDATE`.** One statement, but it bypasses the generated client's types and rewrites every row and `updatedAt`, so a re-run is not write-free.
- **Per-row upserts inside one transaction.** Still two round trips per row.
- **One transaction for the whole run.** Out of scope; it loses per-file stop-and-resume.
- For the spec location: adding `scripts/import-catalog` to Jest roots (the spec would not be typechecked, and the task asked for `apps/api/scripts`), excluding the spec from typecheck (loses checking), and copying the planner into `apps/api` (two sources of truth) all lost to widening `rootDir`.

## Consequences

- A file with only creates costs a constant number of queries per 1000 rows; a re-run costs one read per file and no writes.
- The create/update decision is unit-tested without a database. `import-coins.ts` itself is not; running it against a real database is a pending manual pass.
- A very large changed file holds one pooled connection for up to 10 minutes, since updates are per row. Acceptable for a manual script; revisit if updates become routine at scale.
- Under a concurrent insert of the same key, `created` can be lower than planned, so created + updated + unchanged can fall below total.
- With `rootDir` at the repo root, any api spec can import from anywhere in the repo without a typecheck error. `.claude/rules/api.md` notes this and says not to narrow it back.
