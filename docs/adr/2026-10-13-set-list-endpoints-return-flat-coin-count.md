# Set list endpoints return a flat coinCount from Prisma _count

- **Status:** Accepted
- **Date:** 2026-10-13
- **Source:** orchestrator run `run_20261013_062900` (new-set flow redesign; the shape is the Architect's choice)
- **Code:** `apps/api/src/sets/sets.service.ts`, `apps/api/src/sets/sets.controller.ts`, `packages/shared/src/index.ts`

## Context

Step 1 of the new-set flow shows how many coins each starting point has. `GET /sets/canonical` and `GET /sets/public` returned no count.

## Decision

`SetsService.findAllCanonical` and `findAllPublic` query with `include: { _count: { select: { coins: true } } }` and map each row to a flat `coinCount`, dropping `_count`. In `packages/shared`, `CanonicalSetSummary` gains `coinCount: number`; a new `PublicSetSummary extends UserSetSummary` adds it for the public list (`PaginatedResponse<PublicSetSummary>`); `CanonicalSetDetail` extends `Omit<CanonicalSetSummary, 'coinCount'>`, so detail responses carry no count. `UserSetSummary` is unchanged.

## Alternatives considered

- Add `coinCount` to `UserSetSummary`: the own-sets list, create and rename responses would have to compute it.
- Expose raw `_count`: leaks a Prisma shape into the API contract.
- A denormalised count column: needs a migration, out of scope.
- Fetch every detail on step 1: N requests.

## Consequences

One aggregate per list query, and the types show which responses carry the field. The web reads `coinCount`, so the API must deploy before the web. Adding a count to another list means a new summary type, not a change to `UserSetSummary`.
