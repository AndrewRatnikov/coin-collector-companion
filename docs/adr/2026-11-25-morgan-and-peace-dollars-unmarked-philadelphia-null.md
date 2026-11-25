# Unmarked Philadelphia Morgan and Peace dollars get `mintMark` null, although the modern dollar files use "P"

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** orchestrator run `run_20261125_195719` (Morgan and Peace dollars, growth 2.6; the task says mint marks are "as on the coin: CC, O, S, D, none", and the PRD review asked null or "P")
- **Code:** `scripts/import-catalog/fixtures/us-dollars-morgan.json`, `scripts/import-catalog/fixtures/us-dollars-peace.json`, `scripts/import-catalog/fixtures/README.md`

## Context

`mintMark` is part of a coin's natural key. [2026-11-24-unmarked-philadelphia-dollars-get-mint-mark-p](2026-11-24-unmarked-philadelphia-dollars-get-mint-mark-p.md) gave unmarked Philadelphia coins `"P"` in the five modern dollar files (Presidential through Susan B. Anthony). The Morgan and Peace dollars use the same denomination, `Dollar`, and their Philadelphia coins carry no mint mark. [2026-11-25-unmarked-nickels-dimes-quarters-get-null-mint-mark](2026-11-25-unmarked-nickels-dimes-quarters-get-null-mint-mark.md) already chose `null` for the other pre-1980 series.

## Decision

In `us-dollars-morgan.json` (95 coins) and `us-dollars-peace.json` (24 coins) a Philadelphia strike is `mintMark: null`; the other marks are `O`, `S`, `CC` and `D`. No coin in either file has `"P"` or `"W"`. Both files' `rules-note` and the README section say so and name the departure from the modern dollar files.

The 2026-11-24 ADR is not superseded: it stays in force for its five files. The `Dollar` denomination now carries both conventions. The README's modern dollar section has one added sentence pointing to the Morgan and Peace rule.

## Alternatives considered

- **"P" as in the modern dollar files.** Lost: the task says "none", the coins have no mark, and the cents, nickels, dimes and 1932-1998 quarters use `null`.

## Consequences

- The Morgan and Peace files match the other pre-1980 series; nothing is stamped differently from what is stored.
- Within one denomination, unmarked Philadelphia dollars are `null` before 1971 and `"P"` from 1971. The two sets of years do not overlap, so no key collides, but a reader must know which file family a coin is in.
- Revisit if the catalog moves to one rule for all Philadelphia coins; that would be a new ADR and an import of changed keys. Confirm during the manual pass under growth backlog 2.9.
