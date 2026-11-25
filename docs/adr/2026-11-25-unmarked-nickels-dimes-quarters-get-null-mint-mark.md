# Unmarked nickels, dimes and 1932-1998 quarters get `mintMark` null, while the dollars keep "P"

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** orchestrator run `run_20261125_061116` (Jefferson nickels, Roosevelt dimes, Washington quarters 1932-1998, growth 2.2-2.4; PRD criterion 4, following the brief's "a Mint cell in parentheses means no mark")
- **Code:** `scripts/import-catalog/fixtures/us-nickels-jefferson-copper-nickel.json`, `scripts/import-catalog/fixtures/us-dimes-roosevelt-clad.json`, `scripts/import-catalog/fixtures/us-dimes-roosevelt-silver.json`, `scripts/import-catalog/fixtures/us-quarters-washington-silver.json`, `scripts/import-catalog/fixtures/us-quarters-washington-clad.json`, `scripts/import-catalog/fixtures/README.md`

## Context

`mintMark` is part of a coin's natural key. [2026-11-24-unmarked-philadelphia-dollars-get-mint-mark-p](2026-11-24-unmarked-philadelphia-dollars-get-mint-mark-p.md) chose "P" for unmarked Philadelphia coins in the dollar fixtures and left the choice open for the other US series. The Lincoln cent fixtures use `null`. The three new series come from Wikipedia mintage tables that write the Mint cell in parentheses (`(P)`, `(P/D/S)`, `(P & D)`) where the coin carries no mark.

## Decision

A parenthesised Mint cell becomes `mintMark: null`; a plain letter stays that letter. Unmarked coins: nickels 1938-1942, 1946-1967 and 1971-1979, dimes 1965-1979, quarters 1932-1964 and 1965-1979. The 1965-1967 rows with one combined source figure become one no-mark coin each. The dollar ADR stays scoped to the dollar files.

One exception is kept provisional: the source writes a plain `P` for every 1946-1964 silver dime, though those coins carry no mark. The silver dime file keeps `"P"` (the Mint cell decides), and its `rules-note` and README section flag this as a manual decision to confirm before the production import under growth backlog 2.9.

## Alternatives considered

- **"P" for every Philadelphia coin, as in the dollars.** Lost: the brief says parentheses mean no mark, and the cents, the nearest precedent produced by the same generator, use `null`.
- **`null` for the silver dimes' plain `P`.** Lost for now: the PRD lets the Mint cell decide; cheap to change before 2.9.

## Consequences

The Quarter denomination now carries two conventions: 1932-1998 uses `null`, the 1999-2026 files never do. The years do not overlap, so no natural key collides, but the UI shows "1965 Quarter" next to "1999-P Quarter". Changing the silver dimes to `null` later means a new template version file ([2026-11-21-canonical-template-changes-ship-as-a-new-version-file](2026-11-21-canonical-template-changes-ship-as-a-new-version-file.md)) once they are in production. Revisit when 2.9 confirms or reverses the plain-P dimes.
