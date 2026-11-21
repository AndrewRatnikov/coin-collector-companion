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

The import itself only reads local fixture JSON; it never fetches anything. To draft a new
fixture from Wikipedia, use the generator below and review its output before importing.

## Generating a fixture

```
cd scripts/import-catalog
pnpm run generate -- --article "Washington quarter mintage figures" --series "Washington Quarter" \
  --country USA --denomination Quarter --years 1932-1998 --out fixtures/us-quarters-washington.json
```

Arguments (all required; `--flag value` and `--flag=value` both work):

| Flag | Value |
|------|-------|
| `--article` | Title of the English Wikipedia mintage article, e.g. `Lincoln cent mintage figures` |
| `--series` | The fixture's `name`, e.g. `Washington Quarter` |
| `--country` | The fixture's `country`, e.g. `USA` |
| `--denomination` | Exactly one of `Cent`, `Nickel`, `Dime`, `Quarter`, `Dollar` |
| `--years` | Inclusive range `<from>-<to>`, e.g. `1932-1998`; rows outside it are skipped |
| `--out` | Output file ending in `.json`, relative to `scripts/import-catalog` (not the shell's cwd) |

A bad or missing argument prints the usage and exits 2 without any network request.

**The request.** The generator makes exactly one request to the MediaWiki API
(`action=parse`, `prop=wikitext|revid`, `formatversion=2`, `redirects=1`), with no retry, and
sends the `User-Agent` that `docs/catalog-data-licensing.md` §1 requires:
`coin-collector-companion/0.1 (https://github.com/AndrewRatnikov/coin-collector-companion)`.
Set the optional `WIKIPEDIA_CONTACT` environment variable to append a contact, e.g. the email
named in the licensing doc, without committing it:
`WIKIPEDIA_CONTACT='you@example.org' pnpm run generate -- …`. A failed request or an API error
(e.g. `missingtitle`) exits 1 and writes nothing.

**`sources/`.** The raw API response is saved verbatim, before any parsing, to
`sources/<Article_title>.<YYYY-MM-DD>.json`. Commit it together with the fixture: it is the
exact text (and revision id) the fixture was read from, so every row can be traced and
re-checked even after the article changes. The fixture's `sources` block records the article
URL, revision id, fetch date, that file's path and the licence note.

**What it reads.** Only tables with Year, Mint and Mintage columns (and an optional Comments /
Notes column); every other column, including one headed "Proof", is ignored. In short:

- Business strikes only: rows whose comment says proof, pattern, restrike or bullion are
  skipped, and so are whole tables whose caption or Mintage header says proof.
- `(P)`/`(D)`/… (struck there, no mark on the coin) becomes `mintMark: null`; `D`, `S`, `CC`, …
  are written as the mark.
- A mintage is only ever a figure the article gives (separators and footnotes stripped). An
  empty, "unknown", footnote-only, `^` ("included above") or approximate (`c9`, `>200`) cell
  gives `mintage: null`. Nothing is estimated or filled in.
- Varieties: a caption that names a design (a state, park or design type) becomes the variety
  only in years where tables with different designs meet (e.g. the 2009 DC and territory
  quarters). A row's comment becomes the variety only when it is needed to tell apart rows with
  the same year and mint mark. A `^` row without a comment that repeats another row's key is
  dropped as "included above".
- Any key that is still shared is written out as-is (never merged) and listed in the summary,
  because the import keeps only the last duplicate.
- Wide tables with one column per mint (50 State quarters, American Women quarters) are not
  read yet: they are listed as ignored, and a run that finds no rows exits 1 without writing
  `--out`.

It then prints a summary: rows per table and year range, rows with a null mintage, varieties
taken from row comments, skipped rows by reason, duplicate keys and ignored tables.

**What you fill in afterwards.** The generator leaves `specs`, `isKeyDate` and images empty.
Before importing, add the file-level (and any per-coin) `specs`, mark key dates, add images
only after the Commons licence check (`docs/catalog-data-licensing.md` §2), set a variety by
hand for every duplicate key the summary lists, and check the note varieties it flags.

The parser's tests (`apps/api/scripts/import-catalog-wikitext.spec.ts`,
`import-catalog-mintage-tables.spec.ts`, `import-catalog-generate.spec.ts`) run offline with
`pnpm --filter api test`, against real excerpts saved in `apps/api/scripts/__fixtures__/wikipedia/`.
