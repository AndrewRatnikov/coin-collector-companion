# Unmarked branch-mint business strikes are one no-mark coin per year, with the source figures summed and listed in the fixture

- **Status:** Accepted
- **Date:** 2026-11-21
- **Source:** orchestrator run `run_20261121_195917` (Lincoln Memorial, Bicentennial and Shield cent fixtures, growth 2.1; the product answers say a missing value stays null and nothing is filled from memory)
- **Code:** `scripts/import-catalog/fixtures/us-cents-lincoln-memorial-bronze.json`, `scripts/import-catalog/fixtures/README.md`, `apps/api/scripts/lincoln-cent-fixtures.spec.ts`

## Context

In the "Lincoln cent mintage figures" article, 1964-1967 and 1974-1980 list the Philadelphia strike as `(P)` and the Denver, San Francisco or West Point strikes as `(D)`, `(S)` or `(W)`. The parentheses mean the coin carries no mint mark, so the strikes are the same catalog coin. The generator wrote each as a row with no mint mark, producing duplicate natural keys, and the importer keeps only the last of several rows with the same key (see [2026-11-21-generated-varieties-only-where-rows-need-telling-apart](2026-11-21-generated-varieties-only-where-rows-need-telling-apart.md)). That ADR leaves resolving such duplicates to the maintainer. This run had to pick the resolution, and the same case will recur in the other US series (growth 2.2-2.4).

## Decision

For each year, all business-strike rows whose Mint cell is in parentheses become one row with `mintMark: null`, `variety: null`, and a mintage equal to the sum of the source figures. A `^` row ("included above") adds nothing, so 1981 uses its `(P)` figure alone.

Every summed year is recorded in the bronze fixture's `mintageSums` object (year string to the array of source figures added): 1964-1967 and 1974-1980. The importer ignores the key. `lincoln-cent-fixtures.spec.ts` uses it to check that each sum is correct and that every addend appears in the saved wikitext under `scripts/import-catalog/sources/`.

## Alternatives considered

- One variety per striking mint: rejected, because the coins cannot be told apart and a canonical set would ask the collector for two or three identical 1966 cents.
- Only the Philadelphia figure: rejected, it understates the coin's mintage.
- Null mintage: rejected, it discards figures the source gives.
- Leave the duplicates: rejected, the importer would silently keep one.

## Consequences

- A collector's no-mark 1966 cent is a single catalog coin and the template lists it once.
- The mintage on those rows is an arithmetic sum, not a number printed in the source; `mintageSums` is the audit trail and the test enforces it. Fixtures for later series should use the same key.
- The per-mint split is lost from the catalog. Revisit if a series needs it, for example if mint marks start to be shown for these years.
