# The catalog import leaves a non-approved coin on a fixture key untouched and reports it as a conflict, and seed:canonical refuses to link one

- **Status:** Accepted
- **Date:** 2026-11-26
- **Source:** orchestrator run `run_20261126_213654` (guard the catalog import against user submissions before the production import, growth 2.9)
- **Code:** `scripts/import-catalog/lib/plan.ts`, `scripts/import-catalog/import-coins.ts`, `apps/api/scripts/seed-canonical-sets.ts`, `apps/api/scripts/import-catalog-plan.spec.ts`, `apps/api/scripts/import-catalog-import-coins.spec.ts`, `apps/api/scripts/seed-canonical-sets.spec.ts`, `scripts/import-catalog/README.md`

## Context

The catalog import ([2026-11-21-catalog-import-diffs-per-file-and-writes-one-transaction](2026-11-21-catalog-import-diffs-per-file-and-writes-one-transaction.md)) reads every stored coin for a fixture file's country and denomination and matches them by natural key, whatever their status. Users can submit coins; a submission stays `pending` until an admin approves or rejects it, and only `approved` coins appear in the catalog. Review decisions are final ([2026-10-02-submission-review-rules](2026-10-02-submission-review-rules.md)).

So a pending or rejected submission that shares a natural key with an official fixture coin had its name, specs and images overwritten by the import while staying hidden from the catalog, and `seed:canonical`, which resolves template coins with `findUnique` on the natural key, then linked that hidden coin into a curated checklist. The production import under growth 2.9 is the first run against a database with real user submissions.

## Decision

- **The planner.** `ExistingCoinRow` carries `status`, and `planCoinImport` returns a fourth list, `conflicts` (`{ key, id, status }`). A stored row on a fixture key whose status is not exactly `"approved"` (`APPROVED_STATUS`, compared strictly, so a missing, empty or unexpected status is a conflict too: fail safe) goes only into `conflicts`: it is never updated, and since its key is not in `toCreate`, never created over. Approved rows behave as before. A non-approved row whose key no fixture row has is ignored. The planner stays pure.
- **The import.** `import-coins.ts` selects `status` (and no submitter data). It writes the rest of the file as before, prints one `conflict:` line per conflict with the key, the coin id and the status only, and adds `N conflicts` to the per-file line (`total` counts conflicts). Conflicts stop neither the file nor later files; after the last file the run prints how many conflicts it found and in how many files, and exits 1 if any, so the operator notices.
- **`--check`.** `pnpm run import -- --check` runs the same plan for every fixture (or the given files) and writes nothing: no transaction, no create, no update. It prints the same counts, `created` and `updated` being what a real run would write, with a `[check] ` prefix, and also exits 1 on a conflict. `--check` is the only option; a bare `--` is ignored and any other `--` option fails before any fixture is read.
- **The seed.** `seed:canonical` throws `Coin not approved for template "<name>" (<file>) entry <i>: <key> id=<id> status=<status>`, in the style of its existing "Coin not found" error, when a template coin resolves to a non-approved row. It runs in the resolve loop, before any `CanonicalSetCoin` write for that file.
- **Tests.** `import-coins.ts` now exports its functions (`parseImportArgs`, `importFixtureFile`, `runImport`, `main`, the formatters and `EXISTING_COIN_SELECT`) behind a `require.main === module` guard, as `seed-canonical-sets.ts` already does, and is unit-tested with a mocked Prisma client in `apps/api/scripts/import-catalog-import-coins.spec.ts`.
- **Resolution is human.** Neither script changes a submission. An admin approves it in /admin/submissions (the next import then updates it to the fixture's data), edits its key and approves it if it is really a different coin (the import then creates the official coin), or rejects it. A rejected row keeps blocking the key, because review decisions are final: the import keeps reporting it and exiting 1 until someone makes a deliberate manual database change.

This amends the 2026-11-21 ADR: the plan's fourth list, the log line, the end-of-run exit code, and its consequence that `import-coins.ts` itself is not tested.

## Alternatives considered

- **Keep overwriting.** The bug: a hidden submission takes the official data and lands in a checklist.
- **Approve the submission automatically when it matches a fixture key.** Takes the review decision away from the admin.
- **Treat only `pending` and `rejected` as conflicts.** A missing or unknown status would be overwritten; not fail-safe.
- **Abort the file, or the run, on the first conflict.** Blocks unrelated official coins from landing; reporting and exiting 1 at the end gets the same attention.
- **Exit 0 with a warning.** Easy to miss in a production run.
- **A separate pre-flight script or a documented SQL query.** A second copy of the matching logic that can drift, or one that skips the key sanitising and the plan; `--check` reports exactly what the real run would do.
- **In the seed, skip the entry, or filter `findUnique` by status.** A checklist with a hole nobody notices, or a misleading "not found".
- **Move the import's I/O into `lib/` with injected dependencies.** Would bring Prisma types into `lib/`, which the 2026-11-21 ADR keeps Prisma-free.

## Consequences

- A user submission is never overwritten by official fixture data and never linked into a curated checklist while it is hidden.
- The per-file log line changes to `N created, N updated, N unchanged, N conflicts, N total`; nothing in the repo parses it.
- A run with conflicts exits 1 even though every other coin was written; the operator reads the `conflict:` lines and resolves them in /admin/submissions, then re-runs (re-runs stay idempotent).
- A rejected submission on a fixture key blocks that official coin until a manual database change; a later task could add an admin action that re-keys or deletes such a row.
- `import-coins.ts` is unit-tested without a database (arguments, write and check modes, exit code), and the api typecheck now covers it.
- Running `--check` against production, resolving what it reports, then running the import and `seed:canonical` there stays the **pending manual pass** under growth 2.9.
