# Technical Plan: Week 2 Day 5 — Live E2E Verification & Wrap-up

**Run:** run_20260720_171320
**Date:** 2026-07-20

## Summary

This is a verification/wrap-up task against an already-implemented, already-merged API surface (`SetsController`, `CollectionController`, `CatalogController` in `apps/api/src`) — not new feature work. It has exactly one automated-testable code gap (a missing edge case in `getGaps`'s unit suite) and a large live-verification component (real Neon dev DB, real HTTP calls) that structurally cannot go through this pipeline's Tester/Coder stages, since both are explicitly constrained to mocked I/O ("Do not hit real network or filesystem," Tester agent instructions; "makes the existing [mocked] tests pass," Coder agent instructions). The plan below splits accordingly: Part A (one Jest test addition) runs through the normal Tester → Test-Reviewer → Coder → Sandbox stages. Part B (the live verification pass) is executed directly by the orchestrator via Bash against the real running API + Neon dev DB — the same approach this repo's own history shows for every prior live-verification backlog entry (2.5, 3.3, 3.4, 4.4, 4.5 in `docs/backlog_week2.md`, all narrated as "human-confirmed live," none produced through a mocked-test pipeline).

**Discovered during planning, changes scope:** `docs/backlog_week2.md` tasks **4.4 and 4.5 are already checked off** (commit `4a5057d`, 2026-07-20 17:03:20+03:00 on `main`, minutes before this run branched) with full live-confirmed narratives already matching the exact scenario the task prompt describes. The task prompt's premise that they're "still open" is stale. This plan does **not** re-run 4.4/4.5 as new live checks — task 5.1's own scenario is run fresh (it's unchecked) and happens to re-confirm the same isolation behavior as a side effect, but 4.4/4.5's checkboxes/narratives are left untouched since they're already accurate.

## Approach

**Part A — automated (Tester/Coder/Sandbox pipeline):**
`apps/api/src/sets/sets.service.ts:167`'s `getGaps` already computes `ownedCount`/`totalCount`/`completionPercent` correctly for every case (read directly — the logic is `ownedCount = slots.filter(s => s.owned).length`, `completionPercent = totalCount === 0 ? 0 : Math.round((ownedCount/totalCount)*100)`, no special-casing needed). `apps/api/src/sets/sets.service.spec.ts`'s existing `describe('getGaps — computation ...)` block (line 671) already covers: mixed owned/not-owned slots, the partial/rounding case (1/3 → 33%), zero-coin set (0%, no divide-by-zero), and all-owned (100%). It is missing one PRD-required case: **nonzero total, zero owned** (task 5.4's "no-coins-owned (0%)" case, distinct from the zero-*coin* case already covered). The Tester adds exactly one `it(...)` to that existing `describe` block. Because the existing implementation already produces the correct value for this case, the Coder makes **no changes to `sets.service.ts`** — Part A's only production-relevant file is the test file itself, and the Sandbox run is the actual pass/fail signal for it.

**Part B — live, orchestrator-executed (not through Tester/Coder):**
The already-running local API process (`apps/api/dist/main`, PID confirmed listening on `:3000`, connected to the real Neon dev DB per `apps/api/.env`'s `DATABASE_URL` — confirmed live: `GET /api/v1/catalog` returns `total: 142`) is used directly. All of tasks 5.1, 5.2, and 5.5 are executed as real HTTP/`psql`/Prisma-script calls, in the order given in the PRD, with real observed status codes and response bodies recorded. Task 5.3 is a static read-only spot-check (already partially done during planning: `SetsController`/`SetsService`/`CollectionController`/`CollectionService` all import exclusively from `@coin-collector/shared` with zero local/inline duplicate types — confirmed by reading all four files) plus the two typecheck commands. The real observed results from Part B are written into `docs/backlog_week2.md` (task 5.5 in the Files-changed table below) — this is the one file Part B produces, and it lands via a direct commit (not through the Coder-writes-code-for-tests flow, since there is no test driving it).

**Edge cases handled:**
- Cleanup after Part B's live pass must remove every throwaway row (both users, B's clone + its `UserSetCoin` rows, any `Ownership` rows) from the shared dev DB, since `CLAUDE.md` confirms this is the same DB Render points at in prod. No user-delete endpoint exists (noted as a known gap in 4.5's own backlog entry) — cleanup uses a one-off Prisma script run from `apps/api`, same pattern 4.5 already used, never committed to the repo.
- Task 5.2's Coin-count check is a direct DB query (`psql`/Prisma), not the `GET /catalog` `total` field, per the PRD's explicit instruction — though the catalog endpoint's `total: 142` observed during planning is already a strong signal the count is unchanged.
- Task 5.5's "no Authorization header" checks are literally omitted headers (`curl` with no `-H "Authorization: ..."` at all), not empty/invalid tokens — curl never sends the header unless `-H` is passed, so this is satisfied by simply not passing the flag.

## Files changed

| File | Action | Purpose |
|------|--------|---------|
| apps/api/src/sets/sets.service.spec.ts | MODIFY | Add missing `getGaps` computation case: nonzero total, zero owned → 0% (task 5.4) |
| docs/backlog_week2.md | MODIFY | Check off 5.1–5.5 with brief confirmation notes matching existing style (task 5.5's wrap-up requirement); confirm the Week 2 checkpoint holds |

No changes to any controller, service, DTO, or shared-package file are anticipated — Part B is verification of existing, already-correct behavior, and Part A's new test case passes against the existing `getGaps` implementation unchanged.

## Interface Contract

This section is the single source of truth for names in Part A (the only part with automated tests/testids). Part B has no testids — it is a live runbook, specified below as "Part B Interface: Live Verification Runbook" for the orchestrator's own execution.

### Test addition: `getGaps` — no-coins-owned case
- **File:** `apps/api/src/sets/sets.service.spec.ts` (MODIFY — append to the existing `describe('getGaps — computation (criteria #10, #11 from run_20260720_142942/prd.md)', ...)` block starting at line 671; do not create a new describe block, do not touch any other test in the file)
- **Test name:** `'returns completionPercent: 0 when the caller owns none of the set's coins'`
- **Fixture shape** (matches the existing `mockPrismaService.userSet.findUnique` mock pattern used by every other test in this block):
  ```typescript
  const detail = {
    id: uuidC,
    coins: [
      { id: 'usc-1', position: 1, coin: { id: 'coin-a', ownerships: [] } },
      { id: 'usc-2', position: 2, coin: { id: 'coin-b', ownerships: [] } },
    ],
  };
  mockPrismaService.userSet.findUnique.mockResolvedValue(detail);
  ```
- **Assertions:**
  ```typescript
  const result = await service.getGaps('user-1', uuidC);
  expect(result.ownedCount).toBe(0);
  expect(result.totalCount).toBe(2);
  expect(result.completionPercent).toBe(0);
  ```
- **Distinguishing from existing coverage:** this is `totalCount > 0, ownedCount === 0` — distinct from the existing zero-*coin*-set test (`coins: []`, `totalCount === 0`) and distinct from the existing partial test (`ownedCount === 1`).
- **No production code changes** — `SetsService.getGaps` (`apps/api/src/sets/sets.service.ts:167`) already computes this correctly; this test only pins the behavior down explicitly.
- **Dependencies:** none beyond what the existing spec file already imports (`Test`, `TestingModule` from `@nestjs/testing`, existing `mockPrismaService`, existing `uuidC` fixture constant already declared earlier in the file).

### Part B Interface: Live Verification Runbook (orchestrator-executed, real DB/network)

Base URL: `http://localhost:3000/api/v1` (already-running local process, connected to real Neon dev DB).

**5.1 (+ re-confirms 4.4/4.5's scenario, not re-checking their boxes):**
1. `POST /auth/register` × 2 → users A, B (throwaway emails, e.g. `orchestrator-a-{RUN_ID}@test.local` / `-b-`).
2. `POST /auth/login` × 2 → JWTs for A, B.
3. `POST /sets` as A → blank set `{ name: "Orchestrator verification set" }`.
4. `GET /catalog?limit=5` (no auth) → pick 3–5 real coin ids.
5. `PATCH /sets/:id/coins` as A → `{ add: [ids] }`.
6. `PATCH /collection/:coinId` as A → `{ owned: true }` for one of those ids.
7. `GET /sets/public/:id` as B (no Authorization header) on A's set → expect 200, full coin list, no owner-identifying field in the response body.
8. `POST /sets` as B → `{ name: "B's clone", cloneFrom: { type: "user", id: <A's set id> } }` → expect `clonedFromUserSetId` = A's set id, coins/positions match A's set exactly.
9. `GET /sets/:id/gaps` as B on the clone → expect `ownedCount: 0`, reflecting B's own (empty) ownership, not A's.
10. `PATCH /sets/:id` as B on A's original set → expect 403.
11. `DELETE /sets/:id` as B on A's original set → expect 403.
12. `DELETE /sets/:id` as A on A's original set → expect 200/204.
13. `GET /collection` as A → expect the coin marked owned in step 6 still present/owned.
14. `GET /sets/:id/gaps` (or `GET /sets/public/:id`) as B on B's clone → expect it still exists, coins intact, `clonedFromUserSetId: null`.
15. Cleanup: `DELETE /sets/:id` as B on the clone; one-off Prisma script (run via `ts-node -r tsconfig-paths/register`, not committed) deletes both throwaway `User` rows and any residual `Ownership`/`UserSetCoin` rows tied to them.

**5.2:** Direct DB query (`psql "$DATABASE_URL" -c "SELECT COUNT(*) FROM coins;"` or equivalent Prisma one-liner) → expect `142`. If not 142, stop and investigate before continuing (do not proceed to 5.3+ until resolved).

**5.5:** For each endpoint, `curl` with no `-H "Authorization"` flag at all:
- 401 expected (no header): `POST /sets`, `PATCH /sets/:id`, `PATCH /sets/:id/coins`, `DELETE /sets/:id`, `PATCH /collection/:coinId`, `GET /sets/:id/gaps`.
- 200 expected (no header): `GET /catalog`, `GET /catalog/:id`, `GET /sets/canonical`, `GET /sets/canonical/:id`, `GET /sets/public`, `GET /sets/public/:id`.
- 403 (not 404) for non-owner writes: already exercised in 5.1 steps 10–11.

## Acceptance criteria coverage

| Criterion | Satisfied by |
|-----------|-------------|
| 1. B reads A's public set, 200, no owner-identifying fields | Runbook step 7 |
| 2. Clone's UserSetCoin rows match A's exactly, clonedFromUserSetId set | Runbook step 8 |
| 3. Gaps on clone reflect B's own ownership | Runbook step 9 |
| 4. B's PATCH/DELETE on A's set both 403 | Runbook steps 10–11 |
| 5. (4.4) Set deletion doesn't cascade into ownership | Runbook steps 12–13 |
| 6. (4.5) Clone survives source deletion, clonedFromUserSetId → null | Runbook step 14 |
| 7. Cleanup of all throwaway data | Runbook step 15 |
| 8. Coin row count unchanged (142) | Runbook 5.2 |
| 9. No inline/local type where shared export exists; typecheck clean | Confirmed during planning (all 4 files read, all import from `@coin-collector/shared`) + `pnpm --filter api typecheck` / `pnpm --filter web typecheck` in final verification pass |
| 10. getGaps computation suite covers all 4 cases incl. exact rounding | Test addition above (3 of 4 cases pre-existing, 1 added) |
| 11. Write endpoints 401 unauthenticated | Runbook 5.5 |
| 12. Owner-only writes 403 non-owner | Runbook steps 10–11 |
| 13. Anonymous-documented endpoints 200 with no Authorization header at all | Runbook 5.5 |
| 14. GET /sets/:id/gaps 401 unauthenticated | Runbook 5.5 |
| 15. Final full clean-check suite + backlog.md updated with real notes | Final verification pass (below) + `docs/backlog_week2.md` MODIFY |

## Risks and open questions

- **Pipeline/task-shape mismatch:** this task is structurally a live-verification pass, not new-feature development. Part A fits the Tester→Coder→Sandbox model cleanly (one new mocked unit test, zero production code change expected). Part B (the bulk of the task) requires real DB/network access the Tester/Coder stages explicitly forbid — it is executed directly by the orchestrator via Bash, mirroring exactly how this repo's own prior backlog entries (2.5, 3.3, 3.4, 4.4, 4.5) were performed. This is a deliberate, disclosed deviation from a literal reading of the 5-stage pipeline, not an oversight.
- **Stale task premise on 4.4/4.5:** already discovered and handled above — no action needed, just don't re-touch those two checkboxes.
- **Shared dev/prod DB:** `CLAUDE.md` confirms Render (prod) points at the same Neon DB used here. All Part B mutations are scoped to newly-created throwaway rows and cleaned up in runbook step 15 before this run ends.
- **DELETE /sets/:id response code:** 4.4's existing backlog note says it "returned 200" (not 204) — Part A/B should expect and confirm 200, not assume REST-convention 204, since the actual implementation (`sets.controller.ts` `remove(): Promise<void>`) is what governs, not convention.
