# PRD: Day 5 — Styling pass, navigation, end-to-end manual passes, and wrap-up

**Run:** run_20260722_121303
**Date:** 2026-07-22

## Goal

Week 3 (`apps/web`) has built every route needed for the full coin-collecting journey
(anonymous browse, auth, set creation/cloning, the set editor, gap view, collection
page) across Days 1–4. Day 5 closes the week out: it makes that already-functional
UI presentable and navigable (consistent Tailwind styling, loading states, top-level
nav), then proves the whole journey actually works end-to-end for two independent
users clicking through a real running app, and finally leaves the real dev database
in the same state it started the week in. This is for whoever verifies the Week 3
checkpoint — currently the developer/user, not an end user — confirming the app is
demo-ready and the week's throwaway QA data hasn't polluted the dev DB.

## User stories

- As a developer verifying the Week 3 checkpoint, I want every route to share consistent
  spacing/typography and use the existing `Skeleton`/`ListSkeleton` primitives during
  data fetches, so no page shows a bare blank screen or looks visually inconsistent
  with the rest of the app.
- As any visitor, I want persistent top-level navigation to `/catalog`, `/sets/canonical`,
  and `/sets/public`, with `/dashboard`/`/collection`/login-or-logout swapping based on
  whether I'm authenticated, so I can move around the app without typing URLs by hand.
- As a new user, I want to browse anonymously, sign up, clone a canonical set, land in
  the set editor, add coins, mark some owned, and see gaps/completion % and my
  collection page update live, all in one continuous session, so the core loop is
  provably intact.
- As a second user, I want to find the first user's now-public set via `/sets/public`,
  clone it, and see my own independent (0%) gap view against it, so cross-user cloning
  and per-user ownership isolation are provably correct.
- As the developer closing out the week, I want a clean `typecheck`/`build`/`lint` run
  with zero browser console errors across every touched page, and every throwaway
  user/set/ownership row created during this week's manual passes removed from the
  real dev DB, so Week 3 ends in the same verified-clean state as prior weeks.

## Acceptance criteria

1. Every route built in Days 1–4 (`/catalog`, `/catalog/[coinId]`, `/sets/canonical`,
   `/sets/canonical/[id]`, `/sets/public`, `/sets/public/[id]`, `/dashboard`,
   `/sets/new`, `/sets/[id]`, `/collection`, `/login`, `/signup`) uses the existing
   `SiteFooter`/`FormField`/`Skeleton`/`ListSkeleton` primitives consistently — no
   page shows a bare blank screen during its initial data-fetching query.
2. A top-level navigation component is visible on every page: links to `/catalog`,
   `/sets/canonical`, `/sets/public` always present; `/dashboard` and `/collection`
   links, plus a logout control, shown only when a token is present (via
   `getStoredToken` or an auth-context wrapper); a `/login` link/CTA shown otherwise.
3. A single continuous manual session — anonymous browse of `/catalog` and
   `/sets/canonical` → sign up → clone a canonical set from `/sets/canonical/[id]`
   → land in `/sets/[id]` → add coins via the filter panel → mark some owned →
   gap/completion % update live in the editor → the same coins show owned on
   `/collection` — completes with no unhandled errors.
4. A second-user manual session — the set from criterion 3 is discoverable by a second
   throwaway user via `/sets/public` (public by default), clonable, and the clone
   shows that second user's own independent gap view (0% owned, since ownership is
   per-user) — completes with no unhandled errors.
5. `pnpm --filter web typecheck`, `pnpm --filter web build`, and `pnpm lint` all
   exit clean, and zero console errors appear in the browser across every page
   touched by criteria 3 and 4.
6. Every throwaway user/set/ownership row created by this week's manual passes
   (Days 1–4's 1.6/2.5/3.5/4.5, plus this run's own 5.3/5.4 passes) is removed from
   the real dev DB via a throwaway Prisma script, with row counts confirmed back to
   the Week 2 end-of-week baseline afterward.

## Out of scope

- Any backend/API change of any kind — this is a frontend-only wrap-up week; a UI
  need that implies an API gap is a bug to flag against Weeks 1–2's plan, not
  something to patch in here.
- `is_public` / per-set privacy UI, mid-set drag-and-drop reordering, theme/subject
  tag filtering, public user profiles, Numista/CSV/analytics integrations — all
  explicitly deferred per the backlog's "Explicitly NOT this week" list.
- Deploy verification against Vercel/Render production — Week 3 is local-dev-only;
  that's buffer-week work.
- New automated end-to-end/browser test tooling (e.g., introducing Playwright) —
  the manual passes in criteria 3/4 are executed by hand against running dev
  servers, consistent with how every prior week's "Manual pass" items worked.

## Open questions

- Criterion 6's DB cleanup runs against the real Neon dev database, not a sandbox —
  this script should be written and reviewed as part of this run's code output, but
  the Architect should flag it clearly in the plan as an out-of-sandbox, human-run
  step rather than something the automated test sandbox executes.
- Criteria 3–5 are human-executed manual/verification passes, not unit-testable
  behavior. The Architect should decide which parts of 5.1/5.2 (styling, nav
  auth-state logic) get real automated test coverage from the Tester agent, and
  scope 5.3/5.4/5.5/5.6 as a documented manual checklist for the user to run
  themselves after the automated portion lands.
