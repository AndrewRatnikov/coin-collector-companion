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

Needs `DATABASE_URL` pointed at the target Postgres instance — Prisma Client auto-loads
`apps/api/.env` (the same one `apps/api` itself uses), since that's where `schema.prisma` lives.

This package declares the same `@prisma/client`/`prisma`/`typescript` version ranges as
`apps/api`'s own `package.json` on purpose: it makes pnpm dedupe this package's `@prisma/client`
to the exact same generated-client store entry `apps/api`'s `prisma generate` already populates,
instead of installing a second, separately-generated (or ungenerated) copy. Run
`pnpm --filter api exec prisma generate` first if the client hasn't been generated yet.

## What it does

For each fixture file (shape: `../fixtures/README.md`):

- sanitizes `mintMark`/`variety` — any of `null`/`undefined`/`"None"`/`"N/A"`/whitespace collapses
  to the literal `''` (the only representation of "no value" the DB's natural-key uniqueness
  constraint can dedupe against, §4.1/§4.3)
- gates any inline image metadata through the Commons license check
  (`docs/catalog-data-licensing.md` §2): only `Copyrighted: false` or `AttributionRequired: false`
  images get an `imageUrl`/`imageSource`/`imageLicense`; anything else (e.g. CC BY/BY-SA) is
  skipped, since there's no per-image attribution UI to satisfy it
- upserts each coin by its natural key (`country`, `denomination`, `year`, `mintMark`, `variety`),
  so re-running (or resuming after a failure) is a no-op for rows already imported

Currently only pulls from local fixture JSON, not a live Wikipedia fetch — Day 1's fixtures
(`fixtures/us-cents-lincoln-wheat.json`) are themselves the "confirmed source" data for this
scope. A live-fetch step (with the `User-Agent` `docs/catalog-data-licensing.md` §1 requires)
isn't built yet and isn't needed for the current fixture-driven scope.
