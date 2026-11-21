# Denominations sort by face value in the main unit, parsed from the string with a fixed word table

- **Status:** Accepted
- **Date:** 2026-11-21
- **Source:** orchestrator run `run_20261121_170400` (fix denomination ordering in `packages/shared`; the user chose this option from `docs/catalog-expansion-research.md` "Before adding coins" item 2)
- **Code:** `packages/shared/src/index.ts`, `apps/web/src/lib/denominations.test.ts`
- **Supersedes:** `docs/catalog-expansion-research.md` §"Before adding coins" item 2

## Context

`getDenominationNumeral` and `compareDenominations` read only the first number in a denomination string, and a string with no number counted as 1. "50 Kopiyok" therefore sorted after "10 Hryvnias", and the US words "Nickel", "Dime", "Quarter" and "Dollar" would all read as 1, sort alphabetically and show "1" on the coin placeholder. The catalog grows with US series next. The denomination is part of a coin's natural key, so stored strings are expensive to change (`seed/templates` would change with them).

## Decision

Face value is parsed from the denomination string in `packages/shared/src/index.ts`. Nothing is stored.

- A private table `US_DENOMINATION_WORDS` maps the whole trimmed, lower-cased string to a fixed value: cent 0.01, nickel 0.05, dime 0.10, quarter 0.25, half dollar 0.50, dollar 1. It matches only the whole string, so "Half Dollar" is never read as "Dollar".
- Otherwise the first number is taken as before (leading number, else first anywhere, `,` read as `.`). If the string also contains a minor-unit word (`kopiyka`, `kopiyky`, `kopiyok`, `cent`, `cents`, `euro cent`, `euro cents`; whole-word, case-insensitive, anywhere in the string) the number is divided by 100. Minor words are tested first, so "50 Euro Cent" is minor. Main-unit words (hryvnia, euro, dollar) and unrecognised words keep the plain number. A string with no number and no US word counts as 1, as before.
- `compareDenominations` compares face value in hundredths of the main unit, so ties such as "Dime" and "10 Kopiyok" are exact, then falls back to `localeCompare(…, 'en')` on the original strings.
- `getDenominationNumeral` returns the US word's numeral ("Nickel" -> "5", "Dollar" -> "1") or the number as written, else "1".
- A new export `getDenominationFaceValue` returns hundredths / 100.
- Callers are unchanged: `catalog.service.ts` facets, `collection-view.ts` and `buildCollectionCsv` all go through `compareDenominations`. Because that also reorders `buildCollectionCsv` rows within a country, the export's row order changed. Import does not depend on row order.
- "Half 5 Cents" sorts as 0.05 (minor word anywhere), numeral "5".
- The tests live in `apps/web/src/lib/denominations.test.ts`, because `packages/shared` has no test runner.

## Alternatives considered

- **Spell every value out ("5 Cents", "1 Dollar") and rename the existing "Cent" rows.** Lost: it needs a data migration and changes the natural key and `seed/templates`.
- **A `faceValue` column on `Coin`.** Cleaner, but needs a schema change, a migration and a data model change, out of scope for this run.
- **Strict "number + unit" full-string match only** (considered for "Half 5 Cents"). Lost: that string would sort as 5 instead of 0.05, and no test depends on its position.

## Consequences

- The order is right today with no schema, data or stored-string change, and future US imports can use "Nickel" or "5 Cents".
- The word table is code. A new currency or inflection ("Dollars", "Euros", "Pence", "Half Dime") is not recognised and falls back to "first number wins" until added.
- Face value is derived on every comparison. If more than parsing is needed (filtering by value, mixed currencies), revisit the `faceValue` column.
- Fixed US words are exact-match only, so "Cents" or "Kopiyok" with no number still read as 1.
