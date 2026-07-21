# PRD: Public sets, dashboard, set creation (backlog_week3.md Day 3)

**Run:** run_20260721_161448
**Date:** 2026-07-21

## Goal

A logged-in coin collector currently has no way to see their own sets, browse other users' public sets, or start a new set of their own — Days 1-2 only built anonymous browse (catalog, canonical sets) and auth. This task adds the user-sets/public-sets data layer, a `/dashboard` landing page listing the user's own sets with completion %, a `/sets/public` browse experience (with an authenticated "preview your gaps before cloning" view on the detail page), and a `/sets/new` page that lets a user start a set three ways: blank, cloned from a canonical set, or cloned from another user's public set. This closes the loop between anonymous browsing (Day 2) and the set editor (Day 4) by giving users a way to actually get a set of their own onto their dashboard.

## User stories

- As a logged-in user, I want to see all my own sets with a completion percentage on one dashboard page, so that I can quickly gauge my collecting progress across sets.
- As a logged-in user with no sets yet, I want the dashboard to point me toward creating my first set, so that I'm not looking at a dead end.
- As any visitor (logged in or not), I want to browse other users' public sets and view a set's coin list, so that I can discover sets to collect.
- As a logged-in user viewing a public set, I want to see which of its coins I already own before cloning it, so that I can judge how much of a head start I'd have.
- As a logged-in user, I want to start a new set from scratch, from a canonical template, or by cloning an existing public set — including via a "Clone into my sets" CTA already present on canonical/public set detail pages — so that I have one consistent entry point regardless of where I started.

## Acceptance criteria

1. `apps/web/src/lib/user-sets-api.ts` exports `getUserSets`, `getUserSet`, `createSet`, `renameSet`, `deleteSet`, typed against `packages/shared`'s `UserSetSummary`/`UserSetDetail`/`CreateSetRequestBody`, calling the corresponding `GET /sets`, `GET /sets/:id`, `POST /sets`, `PATCH /sets/:id`, `DELETE /sets/:id` endpoints via the existing `apiFetch` client.
2. `apps/web/src/lib/public-sets-api.ts` exports `getPublicSets`/`getPublicSet`, typed against `PaginatedResponse<UserSetSummary>`/`UserSetDetail` the same way `catalog-api.ts` wraps `PaginatedResponse<CatalogCoin>`, calling `GET /sets/public` and `GET /sets/public/:id`.
3. `apps/web/src/lib/hooks/use-user-sets.ts` and `use-public-sets.ts` expose TanStack Query hooks (`useUserSets`, `useUserSet`, `useCreateSet`, `useRenameSet`, `useDeleteSet`, `usePublicSets`, `usePublicSet`) wrapping the API modules from criteria 1-2, invalidating the relevant query keys on mutation success.
4. `GET /sets/public` renders at `apps/web/src/app/sets/public/page.tsx` as a paginated list (reusing the `PaginatedResponse` page/limit/total pattern already used by `/catalog`), accessible with no auth token present, showing each set's name and coin count/completion summary as returned by the API.
5. `apps/web/src/app/sets/public/[id]/page.tsx` renders a public set's detail (name, ordered coin list) for an anonymous visitor with no owned/missing status shown.
6. When a user with a valid stored token loads the same `/sets/public/[id]` page, it additionally fetches `GET /sets/:id/gaps` for that set and renders each coin's owned/missing status inline (the "preview your match before cloning" behavior) — a `500`/`403`/`404` from the gaps fetch does not block the base coin list from rendering.
7. Both `/sets/canonical/[id]` (already built in Day 2) and `/sets/public/[id]` expose a "Clone into my sets" CTA that is disabled or hidden when no auth token is present, and when clicked while logged in, navigates to `/sets/new` with the clone source pre-filled (no re-picking the source set on the destination page).
8. `apps/web/src/app/dashboard/page.tsx` requires auth (an unauthenticated visitor hitting `/dashboard` directly is redirected to `/login`, per the existing Day 1 guard convention) and, when the user has at least one set, lists every set from `GET /sets` with each set's completion percentage and a link to `/sets/[id]`.
9. When the authenticated user has zero sets, `/dashboard` renders an empty state with a clear call-to-action linking to `/sets/new`, instead of an empty list.
10. `apps/web/src/app/sets/new/page.tsx` requires auth and presents three distinct ways to start a set in one form/flow: (a) blank — just a name, submitted as `{ name }`; (b) clone from an existing canonical set, selectable via a picker; (c) clone from an existing public set, selectable via a picker.
11. When `/sets/new` is reached via a "Clone into my sets" CTA (criterion 7) rather than navigated to directly, the corresponding clone source (canonical or public set) is pre-selected in the picker without requiring the user to re-find it.
12. Submitting any of the three creation paths on `/sets/new` calls `createSet` (criterion 1) with the appropriate `CreateSetRequestBody` shape and, on success, redirects the user to the newly created set's `/sets/[id]` page.
13. On a submission failure (e.g. a validation or server error from `createSet`), `/sets/new` surfaces the error inline on the form rather than navigating away or throwing an unhandled exception.
14. Manual pass (backlog 3.5) completed and documented: logged in as throwaway user A, browsing `/sets/public` with no existing relationship to any listed set, loading a real public set's detail page and confirming the coin list renders; cloning a canonical set via `/sets/new` and confirming the resulting set appears on `/dashboard`; as a second throwaway user B, finding user A's just-created set via `/sets/public`, cloning it, and confirming the redirect to a `/sets/[id]` URL succeeds (the editor's own content is Day 4's scope — this pass only confirms the clone-and-redirect mechanics, per the backlog's own note).

## Out of scope

- The `/sets/[id]` set editor itself (gap-view grid, click-to-toggle ownership, add/remove coins, rename/delete actions) — that is Day 4 (backlog_week3.md Day 4), not this task. `/sets/new` redirects there but does not build its contents.
- `/collection` page and any ownership-toggle UI — Day 4 scope.
- Per-set privacy (`is_public` flag/UI) — explicitly post-MVP per the backlog's "Explicitly NOT this week" list; every set stays public.
- Any backend/API changes — Weeks 1-2 already closed the full API surface this task consumes; if a real API gap surfaces, it is flagged as a scope bug, not patched in from the frontend.
- Top-level navigation/styling pass — that is Day 5 (backlog_week3.md Day 5).
- Mid-set drag-and-drop reordering — not applicable to this task's pages, and out of scope for the whole week per the backlog.

## Open questions

None — Days 1-2 of this backlog are already complete in the repo (auth, `apiFetch` Bearer attachment, catalog, canonical sets), the required `packages/shared` types referenced above (`UserSetSummary`, `UserSetDetail`, `CreateSetRequestBody`) are expected to already exist per the backlog's own conventions section, and the Day 3 checklist in `docs/backlog_week3.md` is unambiguous about scope and acceptance behavior.
