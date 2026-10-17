# Signed-in redesign (2026-10-17)

Implementation brief for the signed-in experience: navigation, My sets, the set page, the Add coins sheet, Collection, the coin page, and the catalog's owned/in-set badges.

**Reference:** [`2026-10-17_signed-in-redesign/`](2026-10-17_signed-in-redesign/). See the README there for how to read the files. `classical.css` is the shared component sheet the mocks use: one class per component, every state, every size. Treat it as the source of truth for exact values, translated into Tailwind tokens and components. Don't copy it in wholesale.

**Status:** approved by Andrew, not yet implemented. This brief **supersedes** the earlier briefs in `docs/design/` where they differ: year headers, numerals, card subtitles, and the set-page header and toolbar. The catalog sidebar brief (2026-10-11) and the new-set flow brief (2026-10-13) still apply; this one only adds badges to the catalog.

**Ship it in phases.** Do one phase per PR and run the full verification for each. Phase 1 is a prerequisite for everything else.

---

## Phase 1 · Foundations (shared, no visible page changes on its own)

1. **Tokens** in `apps/web/src/app/globals.css` `@theme`. These are new colours, already approved:
   - `--color-danger: #a3271f`, `--color-danger-bg: #fbeceb`, `--color-danger-line: #e7b7b3`;
   - placeholder metals `--color-gold-1: #ecd59a`, `--color-gold-2: #c9a55a`, `--color-silver-1: #dedcd8`, `--color-silver-2: #b3afa9`, `--color-copper-1: #dfae88`, `--color-copper-2: #b07651`.
2. **Numerals.** Add `font-variant-numeric: lining-nums` to `body`, and make sure every Cormorant heading inherits it. Every count, year, percentage and spec value uses `font-mono` (Plex Mono) with `tabular-nums`. Year group headers move from Cormorant to Plex Mono 500 at 20px.
3. **Naming rule.** Add `getCoinName(coin) → { eyebrow, title, subtitle }` to `packages/shared`:
   - **title:** the design part of `variety` after a "Series: Design" prefix. If there's none, `name` when it's more than country + denomination. Otherwise the denomination.
   - **subtitle:** country · denomination · year with the mint mark in collector notation (`1909-S`). Leave out any part the title already contains (title = denomination → "Ukraine · 1992"; title = "1909-S VDB" → "United States · 1 Cent").
   - **eyebrow:** the series (the variety prefix) or `''`.
   - The year is never in the title, except for date-style key names.
   - Unit-test it against the examples on the Foundations board: Donetsk Oblast, 1909-S VDB, a plain Lincoln Wheat Cent, and 25 Kopiyok 1992.
   - Then replace `formatCoinLabel` and `getAlbumCardText` at every call site. Today that's `collection/page.tsx`, `catalog/[coinId]/page.tsx`, `catalog/mine/page.tsx`, `sets/canonical/[id]`, `sets/public/[id]`, `sets/[id]` and `admin/submission-review-item.tsx`. Keep `formatCoinLabel` only where a single flat string is truly needed (CSV export, aria labels).
4. **Components** in `apps/web/src/components/ui/`, one file each, each with a test. Classes are in `classical.css`; the spec is the Component spec board.
   - `PlaceholderCoin`:
     - props: `denomination`, `material`, `size` (28 | 40 | 72 | 96 | 180 | 260, or fluid inside a card well using `cqw`), `missing`;
     - tone comes from `material` per the table on the Foundations board;
     - the numeral is the leading number of the denomination (default 1), and the unit is hidden below 72px;
     - when `imageUrl` exists, render the photo in the same circle.
   - `CoinCard`: states owned, missing, pending, failed, key date, selected, and visitor (no check). A stretched link goes to `/catalog/{id}`, and the check sits above it.
   - `StatusToggle`: a `variant="check"` (card disc, 44px hit area) and a `variant="pill"` (list rows). States: idle, pending (spinner, only after 150ms), failed (danger with Retry). `aria-pressed`; the accessible name states the action.
   - `Badge`: owned, in-set, missing, key-date, complete.
   - `SetCard`: progress bar, "N of M owned", %, a "Next: {first missing coin}" line or "{n} to find", and a missing badge; complete state; skeleton.
   - `UndoToast`: bottom centre, lasts 8s, pauses on hover or focus, at most one at a time (a new one replaces and commits the old), announced in a live region, and never takes focus.
   - `Skeleton`: pulse, slower under reduced motion.
5. **Ownership store.** Ownership is global, so one toggle must update every card for that coin and every set's counts. Do it with a single TanStack Query mutation that optimistically updates the collection, set-gaps and catalog caches, and rolls back on error (which shows the failed state).

## Phase 2 · Navigation and home

Boards: Navigation desktop and mobile.

- Signed in, the primary items are **My sets** (`/dashboard`, renamed in the UI) · **Collection** (`/collection`) · **Catalog** (`/catalog`). The active item gets a 2px accent bar.
- The account menu (avatar plus chevron) holds the name and email, Settings, My submissions, Import from CSV (`/collection/import`), a divider, and Log out. Admin is the first item when the role allows it.
- The EN/ES switch is a two-button segmented control in the bar.
- Signed out: **Catalog** · **Checklists** (`/sets`, the curated sets, relabelled) · Log in · Create account (primary).
- Glossary moves to `site-footer.tsx`, next to Help and Send feedback. Remove it from the bar.
- A signed-in user who visits `/` is redirected to `/dashboard`.
- **Under 900px:**
  - the top bar is one 56px row: mark, page title (truncates), one page action, avatar;
  - a bottom tab bar (64px, labels always shown) holds My sets · Collection · Catalog signed in, and Catalog · Checklists · Glossary signed out;
  - Language moves into the avatar menu.
- Update `site-nav.test.tsx` and the `account-menu` tests.

## Phase 3 · My sets (`/dashboard`)

Board: My sets, with a Tweak covering many, one, empty, loading and error.

- **Header:** `h1` "My sets" with "{n} sets" under it. On the right, the link "Browse checklists and collectors' sets" and the primary button **New set** (`/sets/new`).
- **Summary tiles** (3):
  1. **Coins still missing across your sets.** Unique coins: a coin missing from two sets counts once. Includes a "See what to look for" link.
  2. **Closest to complete:** the set name plus "{n} coin(s) to go · {first missing coin}".
  3. **Coins in your collection**, with an "Open Collection" link.
- **Set grid** of `SetCard`s. Sort options: Closest to complete (default), Recently updated, Name A–Z, Most missing.
- **One set:** that card, plus a "A good next set" suggestion. Pick a curated checklist that shares the most coins the user already owns, and say "You already own N of them".
- **Empty:** one primary path, "Choose a curated checklist" (goes to the new-set flow with Curated selected). Below it, three popular checklists with coin counts, and a quiet "Start an empty set" link.
- **Loading:** skeleton tiles and cards. **Error:** a danger alert with "Try again", mentioning that the server may be waking up (the Render cold start).
- **Data:** check whether `GET /sets` returns owned/total per set. If it doesn't, add `ownedCount`, `totalCount` and `firstMissing` (the coin name per the naming rule) to the list response rather than calling `/gaps` once per set. Add a small `GET /sets/summary` for the unique missing count, or compute it in the same query.

## Phase 4 · Set page (`/sets/[id]`)

Boards: Set page desktop (interactive; the `failSaves` Tweak shows failures) and mobile.

- **Album is the default view.** List is the alternative.
- **Header:**
  - a breadcrumb "‹ My sets";
  - an `h1` that **wraps** and is never clipped;
  - a subtitle with the shared parts ("Curated checklist · Ukraine · 10 Hryvnias · 2025–2026");
  - on the right, a progress block: "**11** of 12 owned", "92%" and the bar.
- **Toolbar:**
  - Show (All N / Missing N) and View (Album / List) as segmented controls;
  - on the right, **Select** (album only), **Add coins** (primary) and the ⋯ set menu. The menu keeps Rename, Download missing, Print missing and Delete from the 2026-10-10 brief.
- **Year groups:** the year in Plex Mono 20/500, "N of M owned", a rule, and a ghost button "Mark all N as owned" (or "Mark 1 as owned") when the group has missing coins. It applies at once and shows an undo toast: "Marked N coins from 2026 as owned."
- **Select mode:**
  - the whole card becomes the hit area, selected cards get a 3px accent-700 outline, and checks are hidden;
  - a sticky dark action bar shows "{n} selected", **Mark owned**, **Mark missing** and Cancel;
  - applying shows an undo toast.
  - Bulk calls: add `PATCH /collection` with `{ coinIds, owned }` rather than firing N requests. It's small and needs no schema change.
- **List view:**
  - columns are 40px thumb · name block · year/mint 112px · status pill 150px · ⋯ 44px, so the toggles line up;
  - rows are at least 60px;
  - the ⋯ menu holds Open coin page, Add to another set…, and **Remove from set** (danger, last). Remove has no dialog: it removes immediately and shows the undo toast "Removed {title} from this set.", where Undo re-adds the coin at its old position.
- **Toggle states** everywhere: pending, then success, or failed with Retry. A failed list row gets a danger-bg tint and the subtitle "Couldn't save. Check your connection."
- **Missing filter with nothing missing:** "Nothing missing. This set is complete." with a Complete badge and "Show all coins".
- **Mobile:**
  - the top bar holds back, "My sets", + Add coins and ⋯ (Select and Mark all live there);
  - the album is 2 columns;
  - the list toggle collapses to its disc;
  - the undo toast sits 12px above the tab bar.

## Phase 5 · Add coins sheet

Boards: Add coins desktop and mobile.

- On desktop, a right side sheet `min(560px, 100%)` over a scrim. On mobile, a full-screen dialog.
- **Header:** "Add coins" with "to {set name}", plus Close (desktop) or Close + Done (mobile).
- **Filters:** a search box plus filter chips for Country, Denomination and Year (using the facets from the 2026-10-11 brief), and a "Hide coins in this set" toggle chip. Results filter as you type.
- **Rows:** the name block plus badges **In this set** and **✓ Owned**. Add (secondary, small) turns into "Adding…", then "✓ Added" with an inline Undo, all in place without leaving the sheet. Coins already in the set show "Already added" instead of a button.
- **Footer:** "{n} coins added" and **Done**.
- This replaces the old picker that uses `CatalogFilterForm`. Leave `CatalogFilterForm` in place if anything else still uses it.

## Phase 6 · Collection (`/collection`)

Boards: Collection desktop (interactive) and mobile.

- **Header:** `h1` "Collection", "Every coin you own, across all your sets · N coins", a Cards/Rows switch, and an **Import from CSV** secondary button.
- **Filter bar:** filters as you type, no Search button.
  - search across title, series and denomination;
  - **country chips with counts** (replacing the exact-typed country field);
  - a From–To year range;
  - Clear.
- **Grouping:** country (`h2` with a count), then series, or denomination when there's no series (Cormorant 22 with a count). Each subgroup is a disclosure. The first few are open; any active filter opens all.
- **Cards and rows** use the naming rule and link to the coin page.
- **Un-own:** the card check or the row pill. The card turns to the missing style with the status "Removed", and the toast "{title} ({year}) removed from your collection and every set." offers Undo.
- **Empty filter result:** "No coins in your collection match these filters." with Clear filters. Collection has no first-run empty state in the mocks. Use the My sets empty pattern with "Import from CSV" as the secondary action.

## Phase 7 · Coin page (`/catalog/[coinId]`)

Boards: Coin page desktop (Tweaks: `owned`, `failSaves`) and mobile.

- **Breadcrumb:** Catalog / country / series.
- **Layout:**
  - left: a square placeholder plate (accent-200 when owned, neutral-200 otherwise), with the key-date pill and the caption "Placeholder. A photo from Wikimedia Commons will appear here.";
  - right: eyebrow, `h1` per the naming rule (48px), subtitle.
- **Ownership panel:**
  - not owned: dashed outline, "Not in your collection" and **Mark as owned**;
  - owned: accent-100, "In your collection", "Counted as owned in every set that includes it." and **Remove from collection**;
  - pending and failed: danger-bg, "Couldn't save", Try again.
- **In your sets:** each row shows the set name and a thin progress bar with "N of M owned · %". **Add to a set…** opens a menu of the user's sets as `menuitemcheckbox`es showing "Add" or "✓ Added", plus "New set with this coin". This uses the existing `PATCH /sets/:id/coins`.
- **Specs table:** Diameter, Weight, Thickness, Material, Mintage and Mint mark, with values in mono. A null value shows as "Not recorded" in italic. Attribution line underneath.
- **Mobile:** ownership becomes a sticky bar above the tab bar.

## Phase 8 · Catalog badges

Boards: the Component spec "Catalog result" section.

- For signed-in users only, rows and cards get **✓ Owned** and **In N sets**. On the Add coins sheet this becomes "In this set".
- There's no ownership toggle in the catalog.
- **API:** when `GET /catalog` is called with a user (the `OptionalJwtAuthGuard` route), add `owned: boolean` and `inSetsCount: number` per item. Compute them in the same query, and leave `CATALOG_COIN_SELECT` itself unchanged.

---

## Copy and i18n

- Every new string goes into **both** `en.ts` and `es.ts`, with Spanish in the tone of the existing files.
- Leave room for about 30% longer labels. Buttons size to their content (never a fixed width), titles wrap, and toolbars wrap onto a second line.
- Mobile tab labels must fit 1/3 of 390px in Spanish (Mis colecciones · Colección · Catálogo).

## Accessibility (all phases)

- Hit areas are at least 44px.
- Toggles use `aria-pressed`, and their accessible name states the action ("Mark Odesa Oblast as owned").
- Save results and failures are announced in one polite live region. Toasts never take focus.
- Menus use `role="menu"` with arrow-key navigation, and Escape closes them. Sheets trap focus and return it to the opener.
- Owned and missing differ in lightness and border style (solid versus dashed), not just hue. Secondary text stays at `neutral-700` or darker.
- Respect `prefers-reduced-motion`.

## Out of scope

Prices or market data, photo upload or image hosting, tags or themes, per-set privacy, drag-and-drop reordering, social features beyond the existing public sets, and swaps. Also everything on the CLAUDE.md scope-firewall list.

## Verification (every phase)

`pnpm lint`; `pnpm --filter @coin-collector/shared build`; typecheck for shared, api and web; `pnpm --filter api exec prisma generate && pnpm --filter api test`; `pnpm --filter web test`. No schema change is expected, so no migration. If a phase does need one, follow the Database safety rules in CLAUDE.md. Add a `docs/history.md` entry per phase.
