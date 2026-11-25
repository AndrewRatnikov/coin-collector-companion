# Key dates are flagged only where a saved source names them, and recorded in a `keyDates` block in the fixture

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** orchestrator run `run_20261125_061116` (Jefferson nickels, Roosevelt dimes, Washington quarters 1932-1998; PRD criterion 9, added after the PRD review)
- **Code:** `scripts/import-catalog/fixtures/us-nickels-jefferson-copper-nickel.json`, `seed/templates/jefferson-nickels-key-dates.v1.json`, `scripts/import-catalog/fixtures/README.md`, `apps/api/scripts/jefferson-nickel-fixtures.spec.ts`

## Context

`isKeyDate` is a curated flag, and the brief gave examples (1932-D and 1932-S quarters) from outside the saved sources. Flagging a coin from memory would put an unverifiable claim in the catalog. A README sentence alone could not be checked by a test.

## Decision

`isKeyDate: true` is set only where a saved source article names the coin as a key date. A fixture that has any carries a top-level `keyDates` object with `source` (the saved raw response path), `quote` (verbatim) and `coins` (labels such as `"1939-D"`); the Jefferson spec checks it against the saved file and the flagged coins.

For the Jefferson copper-nickel file the article's prose says "Key dates for the series include the 1939-D, and 1950-D nickels.", so exactly those two coins are flagged and a "Jefferson Nickel Key Dates" checklist holds them. The saved Roosevelt dime and Washington quarter articles name none, so every coin in those files is `false`, they have no `keyDates` block and no key-date checklist. 1932-D and 1932-S stay unflagged.

## Alternatives considered

- **A README sentence only.** Lost: a spec cannot check it.
- **Flagging the brief's examples from outside sources.** Lost: criterion 9 requires a cited, saved source.

## Consequences

Key-date flags are traceable to a quote. Later series with key-date checklists (growth 2.6, Morgan and Peace) can reuse the block. Genuinely well-known key dates stay unflagged until a saved source names them, so the dime and quarter sets have no key-date checklist for now. Adding one means saving a source that names them.
