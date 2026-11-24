# Philadelphia coins struck without a mint mark get `mintMark` "P" in the dollar fixtures, so `mintMark` is never null

- **Status:** Accepted
- **Date:** 2026-11-24
- **Source:** orchestrator run `run_20261124_215121` (modern US dollars, growth 2.10; the PRD, criterion 10, settled this after the PRD review asked whether unmarked Philadelphia coins are null or "P")
- **Code:** `scripts/import-catalog/fixtures/us-dollars-eisenhower.json`, `scripts/import-catalog/fixtures/README.md`, `apps/api/scripts/modern-dollar-fixtures.spec.ts`

## Context

`mintMark` is part of a coin's natural key (country, denomination, year, mint mark, variety). The existing Lincoln cent fixtures follow "mint marks are as on the coin": a Philadelphia coin with no mark is `null`, and the unmarked branch-mint strikes of a year are summed into that one coin ([2026-11-21-unmarked-branch-mint-strikes-summed-into-one-coin](2026-11-21-unmarked-branch-mint-strikes-summed-into-one-coin.md)). The fixtures README also says the quarters files never use null.

The Eisenhower dollar has no mint mark on its Philadelphia issues (the infobox says "Mint mark omitted on Philadelphia Mint issues"), so its 1971-1978 Philadelphia coins are unmarked. The Presidential and American Innovation dollars carry the P on the edge, and the Sacagawea, Native American and Anthony dollars carry it on the obverse or reverse, so only the eight Eisenhower Philadelphia coins are affected. The remaining US series (growth 2.2-2.4: Jefferson nickels, Roosevelt dimes, Washington quarters 1932-1998) will meet the same question.

## Decision

In the five dollar fixtures every coin has a non-null `mintMark`. A Philadelphia strike is `"P"` whether or not the coin shows the mark. The eight Eisenhower Philadelphia coins in `us-dollars-eisenhower.json` are `"P"`, and their file's `rules-note` and the dollars section of `scripts/import-catalog/fixtures/README.md` say so and name the departure from the Lincoln cents. The other mint marks are D for Denver and S for the 1979-1981 Susan B. Anthony strikes. `modern-dollar-fixtures.spec.ts` checks that every coin's `mintMark` is one of P, D or S.

The Lincoln cent files are not changed: their unmarked coins stay `null`.

## Alternatives considered

- `null` for unmarked Philadelphia coins, as the Lincoln cents do: rejected for the dollars. The PRD chose a single rule for the new files, "mintMark is never null", in line with the quarters files.

## Consequences

- Within the new files the rule is uniform and a Philadelphia dollar is always a "P" coin.
- The catalog now has two conventions for the same physical situation: unmarked Lincoln cents are `null`, unmarked Eisenhower dollars are `"P"`. A later series has to pick one, and mixing them within a series would split a coin across two keys.
- The value is not what is stamped on the Eisenhower coin. The README records it as a manual decision to confirm before the production import under growth 2.9.
- Revisit if the catalog starts showing mint marks as "as struck", or if the cents are moved to "P" for consistency. That would be a new ADR superseding this one and an import of changed keys.
