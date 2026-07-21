# PRD: Week 2 Day 5 — Live E2E Verification & Wrap-up (Coin Collector Companion)

**Run:** run_20260720_171320
**Date:** 2026-07-20

## Goal

Week 2's backend build (SetsModule + CollectionModule, Days 1–4) is fully implemented and unit-tested against a mocked Prisma client, but has never been exercised against the real Postgres (Neon dev) database or the real seeded catalog/canonical-set data. This task closes that gap: it runs a live, two-user manual verification pass over the entire Week 2 API surface to confirm ownership isolation, clone lineage, cascade/SetNull FK behavior, and auth boundaries actually hold outside of mocks — folding in two still-open Day 4 manual checks (4.4, 4.5) that structurally require live Postgres behavior to observe. It also does light wrap-up work: a DTO-reuse review, a targeted extension of the gap-computation test suite if any case is missing, and a full clean-typecheck/build/test/lint pass, ending with docs/backlog_week2.md updated to reflect what was actually confirmed.

This is a verification and wrap-up task, not new-feature development — all endpoints under test already exist and are merged.

## User stories

- As the developer closing out Week 2, I want to confirm live Postgres enforces the same ownership/visibility rules the mocked unit tests assumed, so that I can trust the API surface before starting Week 3 frontend work.
- As the developer, I want to confirm that deleting a user's set never touches their ownership records, and that a clone's lineage pointer survives the source set's deletion via SetNull, so that I know the schema's cascade behavior matches the design intent in system-design_v2.md §4.6.
- As the developer, I want every endpoint's auth boundary (401 unauthenticated, 403 non-owner, 200 anonymous-allowed) independently confirmed live, so that no endpoint silently drifts from SD §3's documented contract.
- As the developer, I want the gap-completion percentage calculation's edge cases (0 coins, 0 owned, all owned, partial/rounding) pinned down in the unit suite, so that the one genuinely algorithmic part of the app has explicit regression coverage.
- As the developer, I want docs/backlog_week2.md to accurately reflect what was run and confirmed (not just checkboxes flipped), so that the record is trustworthy for anyone reviewing Week 2 later.

## Acceptance criteria

1. A live two-user session against the real Neon dev DB confirms: user B can read A's set via `GET /sets/public/:id` (200, full coin list, no owner-identifying fields) without any relationship to A.
2. B's clone of A's set (`POST /sets` with `cloneFrom: { type: 'user', id: <A's set id> }`) has `UserSetCoin` rows matching A's set exactly (same coins, same positions) and `clonedFromUserSetId` set to A's set id.
3. `GET /sets/:id/gaps` on B's clone reflects B's own ownership (0% owned), not A's — confirming gap computation is caller-scoped.
4. B's `PATCH /sets/:id` and `DELETE /sets/:id` against A's original (non-owned) set both return 403.
5. (Task 4.4) After A deletes their original set via `DELETE /sets/:id`, `GET /collection` as A still shows the previously-marked-owned coin as owned — confirming set deletion cannot cascade into ownership records.
6. (Task 4.5) After A's set deletion, B's clone still exists with its coins intact, and `clonedFromUserSetId` is now `null` (reset via `onDelete: SetNull`) — not deleted or corrupted.
7. All throwaway test data (B's clone, both throwaway users, and any leftover `UserSetCoin`/`Ownership` rows) is cleaned up from the shared dev DB afterward.
8. Direct query of the `Coin` table confirms row count is unchanged from Week 1's import (142), or the task stops and flags a real bug if it isn't.
9. A spot-check of `SetsController`/`SetsService`/`CollectionController`/`CollectionService` confirms no inline/local type is used where an existing `packages/shared/src/index.ts` export should have been used instead; `pnpm --filter api typecheck` and `pnpm --filter web typecheck` both pass clean.
10. The `getGaps` computation test suite (`apps/api/src/sets/sets.service.spec.ts`) is confirmed (or extended) to explicitly cover: zero-coin set (0%, no divide-by-zero throw), all-coins-owned (100%), no-coins-owned (0%), and a partial/rounding case with the exact expected rounded percentage asserted.
11. Every write endpoint (`POST /sets`, `PATCH /sets/:id`, `PATCH /sets/:id/coins`, `DELETE /sets/:id`, `PATCH /collection/:coinId`) is confirmed to return 401 with no Authorization header.
12. Every endpoint SD §3 documents as anonymous (`GET /catalog`, `GET /catalog/:id`, `GET /sets/canonical`, `GET /sets/canonical/:id`, `GET /sets/public`, `GET /sets/public/:id`) is confirmed to return 200 with no Authorization header at all.
13. `GET /sets/:id/gaps` is confirmed to return 401 with no Authorization header.
14. `pnpm --filter api typecheck`, `pnpm --filter api build`, `pnpm --filter api test`, `pnpm --filter api test:e2e`, `pnpm --filter web typecheck`, and `pnpm lint` all pass clean at the end of the task.
15. `docs/backlog_week2.md` has tasks 4.4, 4.5, and 5.1–5.5 checked off, each annotated with a brief note on what was actually run/confirmed (matching the style of existing entries, e.g. 3.3's "human-confirmed live" phrasing), and the Week 2 checkpoint at the bottom of the file is confirmed to hold.

## Out of scope

- Any frontend work (Week 3).
- `is_public` / per-set privacy controls.
- Drag-and-drop reordering.
- Numista integration.
- Rate limiting.
- Building any new endpoint, controller, service, or module — every endpoint under test already exists and is merged; this task only verifies and, where task 5.4 finds a genuine gap, adds unit test cases for the existing `getGaps` logic.

## Open questions

None — the task specifies exact endpoints, exact scenarios, exact acceptance conditions (200/401/403 codes, field-level checks), and exact cleanup requirements. Live DB credentials and dev-environment access are assumed available to whoever executes the verification steps against the real Neon DB, per the task's explicit reference to CLAUDE.md.
