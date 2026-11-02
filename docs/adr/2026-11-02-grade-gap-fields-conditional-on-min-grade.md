# In the gap view, grade and minGrade are always present and nullable, while needsUpgrade and upgradeCount appear only when the set has a minGrade

- **Status:** Accepted
- **Date:** 2026-11-02
- **Source:** orchestrator run `run_20261102_194108` (coin grades, phase 1 of 4; the shape was left to the Architect by the PRD's first open question)
- **Code:** `packages/shared/src/index.ts`, `apps/api/src/sets/sets.service.ts`

## Context

`GET /sets/:id/gaps` now reports grades. The task required `needsUpgrade` and `upgradeCount` "when the set has a `minGrade`" but did not say what a set without a goal returns. Phases 2-4 build UI on this contract.

## Decision

- `GapSlot.grade` and `GapViewResponse.minGrade` are always present and typed `CoinGrade | null`.
- `GapSlot.needsUpgrade?` and `GapViewResponse.upgradeCount?` are present only when `minGrade` is non-null. Otherwise both keys are absent, not `false` or `0`. `sets.service.ts` spreads them in conditionally.
- With a minimum, `needsUpgrade` is `owned && !meetsMinGrade(grade, minGrade)`, so an owned but ungraded coin needs an upgrade. `upgradeCount` counts the slots where it is true.
- The rule is written as a comment on the shared types so later phases read it in one place.
- Only `GET /sets/:id/gaps` carries per-coin grade and upgrade data in Phase 1. `GET /sets` and the other list endpoints get no `upgradeCount`.

## Alternatives considered

- Always send `needsUpgrade: false` and `upgradeCount: 0` when there is no goal. It makes "no goal set" look the same as "every coin meets the goal", and it breaks the existing convention that `CatalogListItem.owned?` and `inSetsCount?` are omitted when they do not apply.
- Adding `upgradeCount` to `GET /sets` list items now: needs extra per-set grade reads for a list no phase has designed yet. Phase 3 can add it.

## Consequences

Clients must test for key presence (or `minGrade !== null`) rather than read a default. The type's optional keys make that explicit. A future list-level upgrade count would be a separate change.
