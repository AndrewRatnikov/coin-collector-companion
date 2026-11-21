# scripts/import-catalog

Offline, manually-run, resumable/idempotent import of catalog data into the `Coin` table
(`docs/system-design_v2.md` §4.3, `docs/backlog_week1.md` task 4.1). Not part of the API's
request path — `GET /catalog` only ever reads Postgres.

## Running it

```
cd scripts/import-catalog
pnpm run import                       # imports every *.json file under fixtures/
pnpm run import fixtures/foo.json     # or import specific file(s) only
```

Needs `DATABASE_URL` pointed at the target Postgres instance. The script loads
`apps/api/.env` (the same one `apps/api` itself uses) when it exists; a `DATABASE_URL` already
set in the environment wins. Prisma 7 no longer loads `.env` files on its own.

The script imports the Prisma 7 client that `apps/api` generates into
`apps/api/src/generated/prisma` (git-ignored), and connects through the `@prisma/adapter-pg`
driver adapter. Run `pnpm --filter api exec prisma generate` first if the client hasn't been
generated yet. This package declares the same `@prisma/client`, `@prisma/adapter-pg` and `prisma`
versions as `apps/api`, so the generated code, its runtime and the adapter always match.

## What it does

For each fixture file (shape: `../fixtures/README.md`):

- sanitizes `mintMark`/`variety` — any of `null`/`undefined`/`"None"`/`"N/A"`/whitespace collapses
  to the literal `''` (the only representation of "no value" the DB's natural-key uniqueness
  constraint can dedupe against, §4.1/§4.3)
- gates any inline image metadata through the Commons license check
  (`docs/catalog-data-licensing.md` §2): only `Copyrighted: false` or `AttributionRequired: false`
  images get an `imageUrl`/`imageSource`/`imageLicense`; anything else (e.g. CC BY/BY-SA) is
  skipped, since there's no per-image attribution UI to satisfy it
- merges physical specs (`diameterMm`, `weightG`, `thicknessMm`, `material`): a fixture's
  file-level `specs` object is the default, and a coin's own `specs` overrides it field by field
  (e.g. the 1943 steel cent). Per-coin `mintage` and `isKeyDate` are written as-is. Anything
  missing imports as `null` (or `false` for `isKeyDate`) and is simply not shown in the UI
- matches coins by their natural key (`country`, `denomination`, `year`, `mintMark`, `variety`)
  in batches, per file:
  1. one `findMany` reads every existing coin for the file's (`country`, `denomination`);
  2. a pure planner (`lib/plan.ts`, `planCoinImport`) sorts the file's coins into rows to
     create, rows whose name, image fields or spec fields changed, and unchanged rows
     (`null` and a missing value count as equal). If a key appears twice in one file, the
     last entry wins;
  3. one transaction per file writes the difference: `createMany` with `skipDuplicates`, in
     chunks of 1000 rows, then one `update` per changed row carrying only the changed fields.
     If anything throws, nothing from that file is written and the run stops there (files
     are processed one after another, as before)
- re-running on an already-imported database writes nothing (no transaction is opened), so
  resuming after a failure is safe
- never deletes coins: rows in the database that a fixture no longer lists are left alone
- logs one line per file: `<name> (<file>): N created, N updated, N unchanged, N total`, where
  total is the number of distinct natural keys in the file

The planner's unit tests live in `apps/api/scripts/import-catalog-plan.spec.ts` and run with
`pnpm --filter api test`.

Currently only pulls from local fixture JSON, not a live Wikipedia fetch — Day 1's fixtures
(`fixtures/us-cents-lincoln-wheat.json`) are themselves the "confirmed source" data for this
scope. A live-fetch step (with the `User-Agent` `docs/catalog-data-licensing.md` §1 requires)
isn't built yet and isn't needed for the current fixture-driven scope.
