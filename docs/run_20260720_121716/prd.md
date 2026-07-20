# PRD: Canonical-set seed templates + admin seed script (Week 2, Day 3)

**Run:** run_20260720_121716
**Date:** 2026-07-20

## Goal

`CanonicalSet` and `CanonicalSetCoin` are live tables with working read endpoints (`GET /sets/canonical`, `GET /sets/canonical/:id`, built Day 2) but no rows in them — every canonical-set feature built so far (including Day 1's clone-from-canonical flow) has only ever been exercised against a hand-inserted throwaway row. This task gives the app its first real canonical-set content: two versioned JSON seed templates built from the 142 Lincoln Wheat Cent coins already in Postgres (Week 1's `scripts/import-catalog`), and a one-off, manually-run admin script (`apps/api/scripts/seed-canonical-sets.ts`) that resolves each template entry against the catalog and upserts it into `canonical_sets`/`canonical_set_coins`. This unblocks every downstream Week 2/3 feature that assumes at least one real canonical set exists, and proves the seed-template pipeline (SD §4.4) end-to-end rather than just on paper.

## User stories

- As the solo developer running this pipeline manually, I want to author canonical-set templates as versioned JSON files so that a set's content can be corrected or expanded later without silently mutating a set a user already cloned.
- As the same developer, I want one script to load every template file into Postgres idempotently so that re-running it after a fix or a new template addition never produces duplicate rows.
- As the same developer, I want the script to fail loudly on an unresolvable coin reference so that a typo in a template is caught immediately instead of silently producing an incomplete set.
- As an API consumer (the eventual frontend, or a manual `curl`/Postman pass), I want `GET /sets/canonical` and `GET /sets/canonical/:id` to return real, correctly-ordered data so that the canonical-set feature is demonstrably working, not just schema-ready.
- As the same developer, I want to clone a real seeded canonical set via `POST /sets` and see the resulting `UserSet`'s coins/positions match the template exactly, replacing Day 1's hand-inserted-row stand-in check.

## Acceptance criteria

1. `seed/templates/lincoln-wheat-cents.v1.json` exists at the repo root, `name: "Lincoln Wheat Cents"`, and its `coins` array covers all 142 `country: "USA", denomination: "Cent"` rows already in Postgres (years 1909–1958), each entry using the natural key `{ country, denomination, year, mintMark, variety }` with `mintMark`/`variety` as the literal `""` (never `null`) where there is no mint mark/variety.
2. `seed/templates/lincoln-wheat-cents-key-dates.v1.json` (or equivalently named) exists, `name: "Lincoln Wheat Cent Key Dates"`, and its `coins` array is a small, real subset of the same 142-coin dataset — every entry must correspond to a row that actually exists in the catalog (verified before being written, not assumed from numismatic lore).
3. `apps/api/scripts/seed-canonical-sets.ts` exists, is excluded from `apps/api/tsconfig.build.json`'s build (`scripts` added to `exclude`), and is runnable via a new `pnpm --filter api run seed:canonical` script using `ts-node -r tsconfig-paths/register`.
4. The script reads every `*.json` file under `seed/templates/`, and for each file: upserts one `CanonicalSet` row by `name` (`source: "seed-template"`, `templateVersion` taken from the filename's version suffix), resolves every coin entry via `prisma.coin.findUnique` on the natural key, and upserts `CanonicalSetCoin` rows with `position` matching the template's array order.
5. If any coin entry in a template fails to resolve against the catalog, the script throws and stops the entire run (no partial writes for that file) — verified by deliberately breaking one entry and observing the failure, then restoring it.
6. Re-running the script against a DB already seeded by a prior run creates zero new `CanonicalSet`/`CanonicalSetCoin` rows (idempotent), verified directly by running it twice in a row.
7. `GET /sets/canonical` and `GET /sets/canonical/:id` return the two real seeded templates with correct name/source/templateVersion and coins ordered by `position`, verified by direct HTTP calls against the running API.
8. `POST /sets` with `cloneFrom: { type: 'canonical', id }` against one of the two real seeded templates produces a `UserSet` whose coins and positions match the template exactly, replacing Day 1's hand-inserted-row version of this check; any throwaway `UserSet` created for this check is deleted afterward.
9. `pnpm --filter api typecheck`, `pnpm --filter api build`, `pnpm --filter api test`, and `pnpm lint` all pass clean, with `build` specifically confirming `apps/api/scripts/` is excluded from the Nest build output.
10. `docs/backlog_week2.md`'s Day 3 tasks 3.1–3.4 are checked off, with a brief note on any deviation from the task text, matching the style of the already-checked-off Day 1/2 entries.

## Out of scope

- `GET /collection`, `PATCH /collection/:coinId`, `GET /sets/:id/gaps` (Day 4 work).
- The public-set clone-flow, deletion-isolation, and clone-lineage manual passes (Day 5 work).
- A filter-definition-resolving template format (e.g. "all US cents 1909–1958" resolved dynamically) — SD §4.4 allows it, but static coin-reference lists are sufficient to prove the pipeline this week and are what's built here.
- Any new catalog data/denomination beyond the existing 142 Lincoln Wheat Cent coins — both templates are built from this same dataset by design (task 3.1 asks for a multi-file pipeline proof, not multiple coin scopes).
- Creating a second standalone workspace package for the seed script (unlike `scripts/import-catalog`) — this script lives inside `apps/api` per SD §4.4's "apps/api CLI command" framing.

## Open questions

None — the task description and SD §4.1/§4.4 fully specify schema, file layout, and verification steps.

**Process note for the Architect/Coder/verification stages:** Tasks 3.3–3.4's verification steps require running the script against the real Neon dev database (also what Render points at in production, per CLAUDE.md) and doing live psql/HTTP checks, including creating and then deleting throwaway rows. This is an external, hard-to-reverse action against a shared resource. The automated pipeline (Product → Architect → Tester → Coder → sandbox tests) should produce and unit-test the code/template artifacts in isolation; live-DB execution of the seed script, psql spot-checks, and the clone-flow HTTP check against the real dev DB should be confirmed with the user before being executed, and are expected to happen as a manual/human-supervised step after the automated pipeline completes, not autonomously inside the sandbox stage.
