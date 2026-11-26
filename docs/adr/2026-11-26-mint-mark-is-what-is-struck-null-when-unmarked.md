# `mintMark` is what is struck on the coin, `null` when the coin carries no mark, in every US series

- **Status:** Accepted
- **Date:** 2026-11-26
- **Source:** orchestrator run `run_20261126_061240` (catalog data fixes before the production import, growth 2.9; review findings of 2026-11-25)
- **Code:** `scripts/import-catalog/fixtures/us-dimes-roosevelt-silver.json`, `scripts/import-catalog/fixtures/us-dimes-roosevelt-clad.json`, `scripts/import-catalog/fixtures/us-dollars-eisenhower.json`, `seed/templates/eisenhower-dollars.v1.json`, `seed/templates/roosevelt-dimes-1946-2025.v1.json`, `scripts/import-catalog/fixtures/README.md`, `apps/api/scripts/us-mint-mark-rule.spec.ts`
- **Supersedes:** [2026-11-24-unmarked-philadelphia-dollars-get-mint-mark-p](2026-11-24-unmarked-philadelphia-dollars-get-mint-mark-p.md), and the provisional silver-dime exception in [2026-11-25-unmarked-nickels-dimes-quarters-get-null-mint-mark](2026-11-25-unmarked-nickels-dimes-quarters-get-null-mint-mark.md)

## Context

`mintMark` is part of a coin's natural key (country, denomination, year, mint mark, variety). The US fixtures had two conventions for the same physical situation, a Philadelphia coin that carries no mark. The Lincoln cents, Jefferson nickels, clad Roosevelt dimes, 1932-1998 Washington quarters and the Morgan and Peace dollars use `null`. The eight 1971-1978 Philadelphia Eisenhower dollars were `"P"` ([2026-11-24-unmarked-philadelphia-dollars-get-mint-mark-p](2026-11-24-unmarked-philadelphia-dollars-get-mint-mark-p.md)), and the nineteen 1946-1964 Philadelphia silver dimes kept the source's plain `P` as a provisional exception ([2026-11-25-unmarked-nickels-dimes-quarters-get-null-mint-mark](2026-11-25-unmarked-nickels-dimes-quarters-get-null-mint-mark.md)). `docs/system-design_v2.md` §4.1 already says the app-facing convention is `null`, never `"P"`.

None of these fixtures or templates is in production yet: the production import and `seed:canonical` are the pending manual pass under growth backlog 2.9.

## Decision

In every US fixture, `mintMark` is the mark struck on the coin, and `null` when the coin carries no mark.

- The 19 Philadelphia silver dimes 1946-1964 and the 8 Philadelphia Eisenhower dollars 1971-1978 are now `null`. Their keys match the other unmarked US coins.
- Coins that really carry a P keep it: the 1942-1945 wartime silver nickels, the 2017-P cent, every coin from 1980 on that carries the mark, the Susan B. Anthony dollars (including the 1979-P), the Sacagawea and Native American dollars, the Presidential dollars and the American Innovation dollars.
- `apps/api/scripts/us-mint-mark-rule.spec.ts` enforces the rule across all US fixtures: no Philadelphia coin dated before 1980 has `mintMark` `"P"`, except the 1942-1945 wartime nickels and the 1979-P Susan B. Anthony dollar.
- The 1982 Roosevelt dime struck without its mint mark is the error variety `"No P"` (mintage `null`), so it no longer reads as an ordinary 1982 dime.

The roosevelt-dimes and eisenhower-dollars templates were never seeded in production, so their v1 files are corrected in place instead of adding a v2. This is a stated exception to [2026-11-21-canonical-template-changes-ship-as-a-new-version-file](2026-11-21-canonical-template-changes-ship-as-a-new-version-file.md), which stays in force for every template that has been seeded in production. The same exception covers renaming the dime template to `roosevelt-dimes-1946-2025.v1.json` (the 2026 dime is the Semiquincentennial Liberty design, not a Roosevelt dime) and the nickel template to `jefferson-nickels-1938-2025.v1.json` (no saved source lists the 2026 nickel yet).

## Alternatives considered

- **`"P"` for every Philadelphia coin.** Lost: it would rewrite every unmarked cent, nickel, quarter, Morgan and Peace key, and contradict system design §4.1.
- **Keep the provisional silver-dime P.** Lost: two rules inside one denomination's history, and a key that is not what the coin shows.
- **A v2 file for each corrected template.** Lost: it adds a version for a file production never saw, and the v1 would stay behind with stale keys.

## Consequences

- One rule and predictable keys: a collector looks up the coin by what is on it.
- The Neon dev branch may still hold rows under the old keys and sets under the old names from earlier local imports and seeds. The import never deletes, so removing them is a manual step (see `docs/history.md`). Production is unaffected.
- The production import and seed under growth backlog 2.9 stay a pending manual pass.
- A template that has been seeded in production still changes only through a new version file.
