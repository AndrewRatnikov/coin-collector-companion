# GET /sets/summary returns the unique missing count, collection size and suggested checklist in one server-computed response

- **Status:** Accepted
- **Date:** 2026-10-18
- **Source:** orchestrator run `run_20261018_105617` (Phase 3, My sets page; the user approved a small `GET /sets/summary` in answers-product.md, Q2; the contents are the Architect's)
- **Code:** `apps/api/src/sets/sets.service.ts`, `apps/api/src/sets/sets.controller.ts`, `packages/shared/src/index.ts`, `apps/web/src/lib/hooks/use-user-sets.ts`

## Context

The My sets tiles show how many distinct coins are missing across all of a user's sets, and how many coins they own. The one-set state suggests a curated checklist. A coin missing from two sets must count once, which a sum of per-set counts can't give. The PRD had assumed the collection size would come from the length of `GET /collection`, which returns every owned coin in full.

## Decision

`GET /sets/summary` is authenticated, user-scoped and placed before the `canonical` routes in `SetsController`. `SetsService.getSummary` runs five reads in `Promise.all`:

- missing `userSetCoin` slots;
- `ownership.count`;
- the user's `clonedFromCanonicalId` values;
- owned `canonicalSetCoin` rows;
- `findAllCanonical()`.

It returns `{ uniqueMissingCount, collectionCount, suggestedSet }`. `uniqueMissingCount` is deduped in JS with a `Set` of `coinId`. `suggestedSet` is the checklist with the most owned coins (> 0) that none of the user's sets was cloned from. Ties go by name (`localeCompare(…, 'en')`), then id. It is `null` when there is no candidate. It is computed for every user and the web shows it only when the user has exactly one set. The web calls it through `useSetsSummary` with key `['user-sets', 'summary']`, under the prefix that ownership and set mutations already invalidate.

## Alternatives considered

- A separate `GET /sets/suggestion`: one more route and request for one card.
- Building the suggestion in the browser from every checklist's detail plus the collection: N detail requests.
- `GET /collection` length as the collection size: downloads every owned coin to count them.

## Consequences

The whole page costs two requests. The suggestion is cheap to extend, but ranking by owned count is the only rule. The summary does a full scan of the user's missing slots and owned checklist coins per call. If a cross-set missing page is added, `uniqueMissingCount` is the number it should match.
