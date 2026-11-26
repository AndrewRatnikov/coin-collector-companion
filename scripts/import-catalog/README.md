# scripts/import-catalog

Offline, manually-run, resumable/idempotent import of catalog data into the `Coin` table
(`docs/system-design_v2.md` §4.3, `docs/backlog_week1.md` task 4.1). Not part of the API's
request path — `GET /catalog` only ever reads Postgres.

## Running it

```
cd scripts/import-catalog
pnpm run import                       # imports every *.json file under fixtures/
pnpm run import fixtures/foo.json     # or import specific file(s) only
pnpm run import -- --check            # read-only pre-flight over every fixture: writes nothing
pnpm run import -- --check fixtures/foo.json   # pre-flight for specific file(s)
```

`--check` is the only option. A bare `--` is ignored; any other `--` option is an error that
exits 1 before any fixture is read or any database connection is made.

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
     last entry wins. A fourth outcome is a **conflict**: a coin already stored on a fixture
     key whose `status` is not exactly `approved` (a pending or rejected user submission, or a
     missing status) is never updated and never created over, only reported (see
     [Conflicts with user submissions](#conflicts-with-user-submissions));
  3. one transaction per file writes the difference: `createMany` with `skipDuplicates`, in
     chunks of 1000 rows, then one `update` per changed row carrying only the changed fields.
     If anything throws, nothing from that file is written and the run stops there (files
     are processed one after another, as before)
- re-running on an already-imported database writes nothing (no transaction is opened), so
  resuming after a failure is safe
- never deletes coins: rows in the database that a fixture no longer lists are left alone
- logs one line per file: `<name> (<file>): N created, N updated, N unchanged, N conflicts, N total`,
  where total is the number of distinct natural keys in the file, conflicts included. In
  `--check` mode the line starts with `[check] `. Before it, one
  `conflict: <country> <denomination> <year> mintMark="..." variety="..." id=<coin id> status=<status>: not approved, left untouched`
  line per conflict: the key, the coin id and the status, never any submitter data
- conflicts don't stop the file or later files; after the last file the run prints how many
  conflicts it found and exits 1 if there was any, so the operator notices

The unit tests live in `apps/api/scripts/import-catalog-plan.spec.ts` (the planner) and
`apps/api/scripts/import-catalog-import-coins.spec.ts` (arguments, write and check modes, exit
code, against a mocked Prisma client), and run with `pnpm --filter api test`.

## Conflicts with user submissions

Users can submit coins that aren't in the catalog yet (/admin/submissions reviews them). A
pending or rejected submission is hidden from the catalog, and it can sit on the same natural key
as a coin a fixture adds. The import never overwrites such a row with the fixture's name, specs
and images, and can't create the official coin beside it (the key is unique), so it reports it as
a conflict and leaves it untouched.

**Pre-flight.** `pnpm run import -- --check` only reads: it runs the same plan for every fixture,
writes nothing, and prints the same per-file counts (created and updated are what a real run
would write) and conflict lines. It also exits 1 on any conflict. Run it against production
before the import under growth 2.9.

**Resolving a conflict is a human decision, never automatic.** For a **pending** submission, open
/admin/submissions and either:

- approve it: it becomes the catalog coin, and the next import updates it to the fixture's name,
  specs and images;
- edit its key before you approve it, if it is really a different coin: it then no longer sits on
  the fixture key, and the import creates the official coin; or
- reject it.

Then re-run the import (or `--check`).

A **rejected** row, including one you just rejected, keeps blocking its key: review decisions are
final ([2026-10-02 ADR](../../docs/adr/2026-10-02-submission-review-rules.md)), so the import keeps
reporting that key as a conflict and exiting 1. Clearing it needs a deliberate manual database
change (after checking nothing references the row), which this script never makes.

`seed:canonical` (`apps/api/scripts/seed-canonical-sets.ts`) refuses to link a non-approved coin
into a checklist: it stops the template with a `Coin not approved for template ...` error that
names the entry's key, the coin id and its status.

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

## Finding images

```
cd scripts/import-catalog
WIKIPEDIA_CONTACT='you@example.org' pnpm run find-images -- fixtures/ukraine-*.json --dry-run
```

`find-images` looks for a Wikimedia Commons photo of each coin in the given Ukrainian fixtures
and writes an `image` block into the fixture where exactly one file clears every rule below.
Ukrainian coins are excluded from copyright (Commons tags such files `{{PD-UAGov-Money}}`), but a
photo can carry its own licence, so the per-file gate of `docs/catalog-data-licensing.md` §2
still decides. Pass **all** Ukrainian fixtures in one run: coins of the same denomination and
year in other files (a circulation coin and a commemorative, say) are used to tell files apart.

| Flag | Effect |
|------|--------|
| `--dry-run` | Do everything, print the summary, write nothing |
| `--overwrite` | Also look for coins that already have an `image` (by default they are skipped); an existing image is never removed |

Paths are relative to `scripts/import-catalog`. A missing path, an unknown flag or a path not
ending in `.json` prints the usage and exits 2; so does a fixture that can't be read, isn't JSON
or isn't Ukrainian (`country` other than `Ukraine`), before any request is made.

**The requests.** One breadth-first crawl of `Category:Coins of Ukraine` and its subcategories
(4 levels deep, `list=categorymembers`, 500 per page, following `continue`), then
`prop=imageinfo` with `extmetadata` (Artist, Credit, LicenseShortName, Copyrighted,
AttributionRequired) for the candidate files only, at most 5 files per request. Requests go one
at a time and carry the same `User-Agent` as the generator (add a contact with
`WIKIPEDIA_CONTACT`). Each request waits 1 s before it is sent, so Wikimedia's rate limiter isn't
tripped; a full crawl of a few hundred categories takes a few minutes. HTTP 429, HTTP 5xx and
network failures are retried, up to 4 attempts in total: the wait honours `Retry-After` (in
seconds) or otherwise backs off 2 s, 4 s, 8 s, and each wait is capped at 60 s. Every retry prints
a line to stderr. A `Retry-After` above 60 s, a 4th failure, any other failed request or an API
error exits 1 and writes nothing: all writes happen after the last request. If 429s persist, wait
a while, make sure `WIKIPEDIA_CONTACT` is set, and run again (nothing was written, so re-running
is safe).

**Matching.** A wrong picture is worse than none, so the rules are strict:

1. Text is compared after normalising: lowercase, apostrophes dropped, every other non-letter,
   non-digit character a space. A file's text is its title (without `File:` and the extension)
   plus the names of the categories it was found in.
2. The file must name the coin's denomination (a number followed by a unit: `hryvnia`/`hryvni`/
   `hrivna`/`гривня`/`грн`, `kopiyka`/`kopiyok`/`kopek`/`копійка`/`коп`, …) and its year.
3. A circulation coin ignores files with a commemorative marker ("commemorative",
   "anniversary", "пам'ятна", "ювілейна", "річчя", "роковини").
4. Subject: every meaningful word (3+ letters, not "the", "of", …) of the coin's `variety`, or of
   its `titleUk`, must be in the file's text. Files that name another coin of the same year and
   denomination instead are dropped.
5. A commemorative coin needs its subject. A circulation coin that is the only type of its year
   may take a file that names no subject; if the year has several types and the file names
   none of them, the coin is listed as ambiguous.
6. The file must be a single side: width / height between 0.8 and 1.25 (side-by-side obverse
   and reverse composites are left out, a round crop would cut them in half).
7. The file must pass the existing licence gate in `lib/image.ts`: `Copyrighted` false or
   `AttributionRequired` false. Anything else (e.g. CC BY-SA) is rejected and listed.
8. Of what's left the reverse (the design side: "reverse", "rev", "реверс" in the title) wins;
   with no reverse, any side. One file left is a match; several are listed for a human.

**What is written.** `"image": { "url", "source", "license", "copyrighted",
"attributionRequired" }`, inserted after the coin's last member without reformatting anything
else in the file. `url` is Commons' 500 px thumbnail on `upload.wikimedia.org` (the original file
when there is no thumbnail): the web app hotlinks it and nothing is re-hosted. `source` is the
file's Artist (or its Credit when there is no Artist), HTML stripped; `license` is its
LicenseShortName; empty fields are left out.

**Output.** Per file and in total, `matched`, `ambiguous`, `none` and `skipped` (already had an
image) counts, how many of the none were rejected by the licence gate, then three lists to work
through by hand: ambiguous coins with their candidate files, coins rejected by the licence gate
with the files, and coins with no file (`no-match`, or `not-single-side` when only composites
were found).

**Manual steps (pending).** The tests (`apps/api/scripts/import-catalog-commons.spec.ts`,
`import-catalog-image-match.spec.ts`, `import-catalog-fixture-writer.spec.ts`,
`import-catalog-find-images.spec.ts`, run offline by `pnpm --filter api test` on recorded
responses in `apps/api/scripts/__fixtures__/commons/`) never touch the network. The real run is
done on Andrew's machine:

1. Run it with `WIKIPEDIA_CONTACT` set and `--dry-run`, read the three lists, then run it again
   without `--dry-run`.
2. Review the fixture diff: only `image` blocks should be added. Open a few URLs to check each
   is the right coin and side. Add an ambiguous coin's image by hand if you want it.
3. Commit the fixtures, then run the production import (`pnpm run import`) under growth 2.9.
4. Check a Ukrainian coin page, the catalog list, the collection and a set album on a phone
   (320-390 px): round photos, not stretched, and the footer's Wikipedia credit still there.
