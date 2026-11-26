# A hand-entered manual source file under `sources/` can be a fixture's cited source, as a further `sources[]` entry and as `keyDates.source`

- **Status:** Accepted
- **Date:** 2026-11-26
- **Source:** orchestrator run `run_20261126_230345` (fill Susan B. Anthony 1979-1981 mintages and Morgan/Peace key dates from committed source files; the PRD review asked how a row traces to a second source)
- **Code:** `scripts/import-catalog/fixtures/us-dollars-susan-b-anthony.json`, `scripts/import-catalog/fixtures/us-dollars-morgan.json`, `scripts/import-catalog/fixtures/us-dollars-peace.json`, `apps/api/scripts/modern-dollar-fixtures.spec.ts`, `apps/api/scripts/morgan-peace-dollar-fixtures.spec.ts`

## Context

Until now every fixture cited a saved raw Wikipedia response. This run's figures come from three files Andrew committed by hand under `scripts/import-catalog/sources/`: `manual-susan-b-anthony-mintages.2026-11-26.json`, `manual-morgan-dollar-key-dates.2026-11-26.json` and `manual-peace-dollar-key-dates.2026-11-26.json`. The Anthony article has no mintage table, so the nine 1979-1981 mintages could not come from Wikipedia, while the coins and the 1999 figures still do. The `keyDates` block ([2026-11-25-key-dates-recorded-in-fixture-keydates-block](2026-11-25-key-dates-recorded-in-fixture-keydates-block.md)) allows one `source` and one `quote`, and no single quote names both Morgan key dates.

## Decision

A manual source file is cited exactly like a saved response, with no change to the field names or the `FixtureSource` type:

- **Mintages:** the Anthony fixture gets a new `sources[1]` (`type`, `origin`, `url`, `fetchedAt`, `rawResponse: "sources/manual-susan-b-anthony-mintages.2026-11-26.json"`, `license`, `note`). The Wikipedia entry stays `sources[0]` and the physical-specs entry moves to `sources[2]`. The `license` is the manual file's own licence text: the figures are facts (`docs/catalog-data-licensing.md` section 1), and it states that coinmintages.com is not a US Mint publication, so the section 3 note is not used. The spec ties the 1979-1981 rows to the manual file and the 1999 rows to Wikipedia.
- **Key dates:** `keyDates.source` may be a manual file. Morgan cites `sources/manual-morgan-dollar-key-dates.2026-11-26.json` with the quote "Rare & Key Dates: 1889-CC, 1893-S, 1895 (Proof)", which names both coins; Peace cites `sources/manual-peace-dollar-key-dates.2026-11-26.json` with "the 1928, which serves as the series key". The block's shape (`source`, `quote`, `coins`) is unchanged.
- The fixtures' `$schema-note` and `rules-note` are rewritten so they no longer claim the 1979-1981 mintages are null or that only Wikipedia is cited.

## Alternatives considered

- **A per-coin source field.** Lost: a new field on every row and a change to the import types.
- **Replacing `sources[0]` with the manual file.** Lost: the coins and the 1999 figures still come from Wikipedia.
- **Changing `keyDates` to several sources and quotes.** Lost: the manual file's single quote already names both Morgan coins, so no shape change is needed.

## Consequences

Every figure and key-date flag still traces to a file in `sources/`, with no schema change; `import-coins.ts` ignores `sources` and `keyDates`, so the import is unaffected. The row-to-source link for the Anthony mintages is by year range in the spec, not by a field, so a later row from a third source needs the spec extended. The manual files are hand-entered, so their accuracy rests on Andrew's copy; the Anthony note records that a PCGS article gives 2,908,145 for each 1981 coin, against the coinmintages.com figures used.
