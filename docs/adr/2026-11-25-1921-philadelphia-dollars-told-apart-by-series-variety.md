# The 1921 Philadelphia Morgan and Peace dollars are told apart by the varieties "Morgan" and "Peace"

- **Status:** Accepted
- **Date:** 2026-11-25
- **Source:** orchestrator run `run_20261125_195719` (Morgan and Peace dollars, growth 2.6; settled in the PRD after the PRD review found the two coins would share a key)
- **Code:** `scripts/import-catalog/fixtures/us-dollars-morgan.json`, `scripts/import-catalog/fixtures/us-dollars-peace.json`, `seed/templates/morgan-dollars-1878-1921.v1.json`, `seed/templates/peace-dollars-1921-1935.v1.json`

## Context

The natural key is country, denomination, year, mint mark and variety; the fixture `name` is not part of it. The task fixes the denomination of both series as `Dollar`. Both a Morgan and a Peace dollar were struck in Philadelphia in 1921, with no mint mark. Without a variety both would be `USA|Dollar|1921||` and an import would keep only one of them. No other year or mint overlaps between the two series, or with the modern dollars (1971 onward).

## Decision

The 1921 Philadelphia coin in the Morgan file (mintage 44,690,000) has `variety: "Morgan"`; the one in the Peace file (1,006,473) has `variety: "Peace"`. These are the only coins with a variety in either file, so the keys are `USA|Dollar|1921||Morgan` and `USA|Dollar|1921||Peace`. The 1921 Morgan S and D coins and all other coins have `variety: null`. Both `rules-note` fields and the README explain the exception.

A later series that shares a year, mint mark and denomination with an existing one must be separated the same way.

## Alternatives considered

- **A different denomination such as "Morgan Dollar".** Lost: the task fixes "Dollar".
- **A series variety on every coin.** Lost: varieties are only for rows that need telling apart ([2026-11-21-generated-varieties-only-where-rows-need-telling-apart](2026-11-21-generated-varieties-only-where-rows-need-telling-apart.md)).
- **A variety on only one of the two coins.** Lost: the other would read as "the" 1921 dollar.

## Consequences

- Both coins import and appear in the collection CSV round trip as separate coins; the matcher sees no shared token between the two varieties.
- The UI shows the variety as the coin title for these two coins ("Morgan" or "Peace" under the series name); this was left as is.
- The 1878 8TF and 7TF tail-feather varieties and the 1921 Peace high relief are not split out, because the source has no separate rows with their own figures. Adding them later would change existing keys or add coins and needs a new source.
