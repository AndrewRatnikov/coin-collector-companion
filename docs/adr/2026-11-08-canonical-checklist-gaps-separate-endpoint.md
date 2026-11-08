# Curated checklists get their own auth-only GET /sets/canonical/:id/gaps that reuses GapViewResponse, with minGrade always null

- **Status:** Accepted
- **Date:** 2026-11-08
- **Source:** orchestrator run `run_20261108_173105` (phase 1 of the spec in the run's task.md: API gaps for curated checklists; the slot mapping was an open item the PRD left to the Architect)
- **Code:** `apps/api/src/sets/sets.controller.ts`, `apps/api/src/sets/sets.service.ts`, `docs/system-design_v2.md`

## Context

A signed-in user could see progress (owned and missing coins, completion percent) only on their own sets, through `GET /sets/:id/gaps`. Curated checklists (`CanonicalSet`) are global and public, and `GET /sets/canonical/:id` returns the coin list with no per-user data. The task asked for the caller's own progress on a checklist, with the web to follow in a later phase.

`CanonicalSetCoin` has the same shape as `UserSetCoin` (`id`, `coinId`, `position`, unique on set and coin), so its rows can fill a `GapSlot` directly.

## Decision

- New route `GET /api/v1/sets/canonical/:id/gaps`, handler `SetsController.getCanonicalGaps`, declared right after `findCanonicalById` and before the other `:id` routes. It has no `@Public()`, so the global JWT guard returns 401 without a token. `ParseUUIDPipe` returns 400 for a non-UUID, and the service throws `NotFoundException('Canonical set not found')` for an unknown id.
- The response is the existing `GapViewResponse`. Slot `id` is `CanonicalSetCoin.id` and `position` is `CanonicalSetCoin.position`, ordered by position. `owned` and `grade` come from the caller's own `Ownership` rows only, so other users' rows never affect the result.
- `minGrade` is always `null`, because checklists have no minimum grade. By [2026-11-02-grade-gap-fields-conditional-on-min-grade](2026-11-02-grade-gap-fields-conditional-on-min-grade.md) the `needsUpgrade` and `upgradeCount` keys are therefore absent.
- `SetsService.getCanonicalGaps(callerId, checklistId)` runs one `canonicalSet.findUnique` with a `select`. The coin is read with `CATALOG_COIN_SELECT` plus a caller-filtered `ownerships` relation, and `ownerships` is stripped before the coin goes into the response.
- The slot, count and percent rules sit in one exported pure function, `buildGapView`, which `getGaps` and `getCanonicalGaps` both call. Each method keeps its own Prisma query. `getGaps` keeps its query and output unchanged.

## Alternatives considered

- **Optional-auth `owned`/`grade` fields on `GET /sets/canonical/:id`.** Rejected: it mixes per-user data into a public read and changes `CanonicalSetDetail`.
- **Slot `id` = `coinId`.** Rejected: on `/sets/:id/gaps` the slot id is the join-row id, and a different meaning here would make the web key rows differently per page.
- **Move `getGaps` onto the new `select` query and share one method that runs the query.** Rejected for this run: it would change the assertions in the existing `sets.service.spec.ts`, which the PRD required to stay as they are.

## Consequences

- The web can reuse the gap types and hooks for checklists unchanged, and the public checklist read stays identical for signed-out visitors.
- No migration and no shared-type change.
- Known gap, not fixed here: `GET /sets/:id/gaps` still returns each slot's full `Coin` row (including `submittedByUserId` and `rejectionReason`) plus the caller's `ownerships`, which breaks the rule that catalog reads use `CATALOG_COIN_SELECT`. The new endpoint does not repeat this. Moving `getGaps` onto `CATALOG_COIN_SELECT` is now a one-query change, but it needs its existing specs updated.
- If checklists ever get a minimum grade, `buildGapView` already supports it via its `minGrade` argument.
