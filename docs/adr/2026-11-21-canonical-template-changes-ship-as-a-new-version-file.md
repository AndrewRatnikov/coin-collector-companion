# A changed canonical template ships as a new `.vN+1.json` file, and `seed:canonical` seeds only the newest version of each template

- **Status:** Accepted. [2026-11-26-mint-mark-is-what-is-struck-null-when-unmarked](2026-11-26-mint-mark-is-what-is-struck-null-when-unmarked.md) records an exception: a template never seeded in production is corrected in place in its v1 file
- **Date:** 2026-11-21
- **Source:** orchestrator run `run_20261121_222133` (close the Ukraine catalog gaps: 14 first-type 10-hryvnia commemoratives, 2016 1 hryvnia)
- **Code:** `apps/api/scripts/seed-canonical-sets.ts`, `apps/api/scripts/seed-canonical-sets.spec.ts`, `seed/templates/ukraine-circulating-commemoratives.v1.json`, `seed/templates/ukraine-circulating-commemoratives.v2.json`

## Context

The run added 15 coins to the Ukrainian circulating commemoratives checklist. Template files are named `{slug}.vN.json`, and the seed script records `N` in `canonical_sets.template_version`. A published version is meant to stay as it was: editing it in place would change a checklist that users may already have cloned or tracked. Before this run `resolveTemplatePaths` seeded every `.json` file in `seed/templates/` when no paths were given, so two versions of one slug would both have been seeded under the same set name. Each would have rewritten the other's coin positions and `templateVersion`, and the order would have depended on readdir order (and on `v10` sorting before `v2` as a string).

## Decision

- The changed template is added as `seed/templates/ukraine-circulating-commemoratives.v2.json`. `v1` stays in the tree, untouched.
- `latestTemplateVersions` in `apps/api/scripts/seed-canonical-sets.ts` keeps, per slug (the file name without `.vN.json`), only the path with the highest `N`, compared as a number. `resolveTemplatePaths` applies it to the directory listing when no arguments are given.
- Slugs are compared whole, not by prefix, so `lincoln-wheat-cents` and `lincoln-wheat-cents-key-dates` are still separate templates and both are seeded.
- A file name without a `.vN` suffix passes through unchanged, so `seedTemplateFile` still rejects it with the existing `parseTemplateVersion` error.
- Paths named explicitly on the command line are used as given, so an operator can still seed an old version on purpose.

## Alternatives considered

- **Edit `v1` in place.** Rejected: it silently changes a published version and the recorded `templateVersion` would no longer say what the file contained.
- **Add `v2` and delete `v1`.** Rejected: the published file leaves the tree, and the pipeline's file contract has no delete action.
- **Add `v2` beside `v1` and change nothing in the script.** Rejected: both would be seeded under one set name, flipping positions and `templateVersion` on every run.

## Consequences

- Every later template correction follows the same rule: a new `.vN+1.json`, no script change.
- Superseded versions accumulate in `seed/templates/`. They are never seeded by default.
- Seeding the checklist after this run updates the existing set to `v2` (new coins appended per the seed script's position handling); that seed is a manual production pass, not part of the run.
- `docs/system-design_v2.md` §4.4 says the version suffix exists but not how several versions are loaded. It is refined by this ADR, not contradicted.
