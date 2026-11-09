# The public set page takes the viewer's progress from `GET /sets/:id/gaps` and ignores the owner's grade fields

- **Status:** Accepted
- **Date:** 2026-11-09
- **Source:** orchestrator run `run_20261109_220451` (own progress on curated checklists and public sets, Phase 2: Web; the Architect checked the PRD's assumption against `SetsService.getGaps`)
- **Code:** `apps/web/src/app/sets/public/[id]/page.tsx`, `apps/web/src/lib/hooks/use-user-sets.ts`, `apps/api/src/sets/sets.service.ts`

## Context

Phase 2 shows a signed-in visitor their own progress ("You own X of Y") on another user's public set. Phase 1 added a gaps endpoint for curated checklists ([2026-11-08-canonical-checklist-gaps-separate-endpoint](2026-11-08-canonical-checklist-gaps-separate-endpoint.md)), but the public page already called `useSetGaps` (`GET /sets/:id/gaps`) for its overlap line. `SetsService.getGaps(callerId, setId)` has no owner check and reads ownerships filtered to `callerId`, so `owned`, `grade`, `ownedCount`, `totalCount` and `completionPercent` are already the caller's own. The response also carries the set owner's `minGrade`, and so `needsUpgrade` per slot and `upgradeCount`.

## Decision

`/sets/public/[id]` keeps `useSetGaps(isLoggedIn ? id : '')` and renders progress, per-coin owned/missing marks and the clone label from it. It never reads `minGrade`, `upgradeCount` or `needsUpgrade`: no upgrade slot is passed to `SetProgress`, no `UpgradeBadge` is rendered. Signed-out visitors get no query and the page looks as before. No API change.

## Alternatives considered

- **A public-set gaps endpoint that omits the owner's goal.** Rejected: Phase 2 is web-only, and the extra fields can simply be ignored.

## Consequences

- No API work and no new query on the public page.
- The owner's `minGrade` still travels to the viewer's browser in the response. This is not new (the page already fetched this response) but the page's correctness now depends on the discipline of not reading those fields; a comment in the page says so.
- Revisit if the gap response ever gains owner-private data that must not reach other viewers; then a dedicated endpoint is needed.
