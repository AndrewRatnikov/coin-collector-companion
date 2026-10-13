# Creating a set is one request; coins are picked afterwards in the set editor

- **Status:** Accepted
- **Date:** 2026-10-13
- **Source:** orchestrator run `run_20261013_062900` (new-set flow redesign; approved in the design brief `docs/design/2026-10-13_new-set-flow.md`)
- **Code:** `apps/web/src/app/sets/new/page.tsx`, `apps/web/src/lib/new-set-preview.ts`

## Context

`/sets/new` let the user pick coins in the page and then did a create followed by `PATCH /sets/:id/coins`. That meant two requests, a window where the set existed without the user's edits, and a second code path next to the full clone that `SetsService` already performs on create.

## Decision

`/sets/new` is a two-step flow on one route: step 1 chooses the starting point, step 2 names the set. Coin picking and the pending list are gone. Submitting sends a single `POST /sets` with `{ name }` or `{ name, cloneFrom: { type, id } }` and redirects to `/sets/{id}`. Coins are edited afterwards with the set page's Add-coins sheet. An unknown or malformed source id is detected by the detail query failing (404 or 400), which sends the user back to step 1; it is not checked against the loaded list.

## Alternatives considered

- Keep the picker and create-then-patch: two requests and a partial-failure state.
- A new atomic "create with coin list" endpoint: new API surface, out of scope.
- Detect a missing source by list membership: the public list is paginated and capped at 100, so a valid id could be absent.

## Consequences

One code path for creation, reusing the full clone. Users can no longer build a custom coin list before the set exists; they add coins on the set page. This replaces the create-then-patch design from `run_20260728_071525`, which had no ADR.
