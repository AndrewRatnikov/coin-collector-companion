# PRD: "My Submissions" — GET /catalog?submittedByMe=true

**Run:** run_20260731_132040
**Date:** 2026-07-31

## Goal

A user who submits a coin via `POST /catalog` sees it once, on the one-time submission-confirmation screen shown immediately after success. If they navigate away without adding it to a set, the coin becomes effectively unrecoverable to them — catalog browse and the set editor's "Add coins" picker are both backed by `GET /catalog`, which only ever returns `status: 'approved'` rows, so a still-`pending` (or `rejected`) submission never resurfaces anywhere. This closes that gap: an authenticated caller can pass `submittedByMe=true` on `GET /catalog` to get back every coin they personally submitted, regardless of its review status, and a small dedicated page in the web app surfaces that list so a lost pending coin can be found and (via its existing detail page) still added to a set. This is a pure recovery path, not a replacement for the confirmation screen or a step toward admin review tooling.

## User stories

- As an authenticated user who submitted a coin and then navigated away from the confirmation screen, I want a page listing everything I've submitted (any status) so I can find and recover a pending coin I lost track of.
- As an authenticated user viewing my submissions list, I want each entry's review status shown (pending/approved/rejected) so I know what state it's in before I try to act on it.
- As an authenticated user, I want each submission in the list to link to its own catalog detail page so I can still add it to a set through the existing, unchanged add-to-set flow.
- As an anonymous visitor browsing the catalog, I want `GET /catalog` to behave exactly as it does today (approved-only) even if `submittedByMe=true` is present on the request, so an unauthenticated request can never leak status-gated data or error out.
- As a user, I want my normal `GET /catalog` calls (no `submittedByMe`) to be completely unaffected by this change, whether I'm authenticated or not.

## Acceptance criteria

1. `GET /catalog?submittedByMe=true` sent with a valid bearer token returns only coins where `submittedByUserId` equals the caller's own user id, across all statuses (pending, approved, rejected) — the `status: 'approved'` filter is replaced, not OR'd in, for this call only.
2. `GET /catalog?submittedByMe=true` sent with no bearer token (or an invalid/expired one) returns exactly what a normal anonymous `GET /catalog` call returns today (`status: 'approved'` only) — no 401, no error, `submittedByMe` is silently ignored.
3. `GET /catalog` with `submittedByMe` absent or `false` behaves identically to pre-existing behavior, for both anonymous and authenticated callers.
4. When `submittedByMe=true` is honored, the other existing filters (`country`, `denomination`, `name`, `yearMin`, `yearMax`, pagination) still apply on top of the `submittedByUserId` filter.
5. The response shape for `GET /catalog` is unchanged regardless of `submittedByMe` — no new fields added, `submittedByUserId` itself is never included in any response row.
6. An authenticated user can reach a page in the web app (route TBD at implementation time) that lists every coin they've personally submitted, each row showing name/year/mint mark and a status badge reflecting pending/approved/rejected.
7. That page is reachable via a discoverable link from an authenticated part of the site (settings page or main nav, decided at implementation time based on what else has shipped).
8. Each row in that list links to the coin's own `catalog/[coinId]` detail page (not directly to a set), and from there the existing add-to-set mechanism works unchanged for a pending coin.
9. An unauthenticated visitor cannot reach the new page (it is auth-gated, consistent with the existing `RequireAuth` pattern).
10. All new user-facing strings (page title, empty state, status badge labels) are present in both `en.ts` and `es.ts`.

## Out of scope

- Surfacing a caller's pending/rejected coins in the normal catalog browse view or the set-editor's "Add coins" picker — both stay approved-only, unchanged. This backlog adds one distinct opt-in list, not a general change to default browse behavior.
- Any admin/moderation UI or approve/reject functionality — review remains manual, direct-to-DB, exactly as today.
- Editing or withdrawing a pending submission from the new page — it is read-only; there is no `PATCH`/`DELETE /catalog/:id`.
- Reusing the new optional-auth guard pattern anywhere else in the API — scoped to `GET /catalog` only for now.

## Open questions

None — the source backlog document (`docs/backlog_my-submissions.md`) already resolves scope, the exact filter-replacement semantics, the guard/decorator design, and the explicit exclusions. The only items left to the Architect/Coder's discretion, per the backlog itself, are: the new page's exact route path, and whether its nav entry point lives on the settings page or in the main site nav (decided at implementation time based on which has actually shipped).
