# Set album view redesign (2026-10-10)

Implementation brief for the redesigned set album view. Reference markup is in [`2026-10-10_album-view/`](2026-10-10_album-view/):

- `album-page.dc.html`: the whole page (header, toolbar, ⋯ menu, year groups, card grid, delete dialog, "set deleted" state). It's a template with `{{holes}}`, `<sc-for>` loops and `<sc-if>` branches, and its `renderVals()` script at the bottom computes every per-state inline style. Read it as a source of exact values, not as runnable HTML.
- `card-states.html`: the five card states side by side, as static HTML. Open it in a browser to see them.

**Status:** design approved by Andrew, not yet implemented. The design was made in a Claude Design canvas.

## Goal

The album card is the main thing a collector scans on this page, so owned and missing coins have to be easy to tell apart at a glance (the gap view is the product's differentiator; see CLAUDE.md). Problems with the current card (`apps/web/src/components/sets/set-album.tsx`):

- The 40px numeral circle and the 32px check sit side by side, squeezing the title into about 6 characters per line ("Autonomou-s Republic", "Dnipropetro-vsk").
- The year repeats on every card, but it's already the group heading.
- Owned and missing cards share the same `bg-surface` background, so the only owned signal is a small check.
- There's no visible photo, even when `coin.imageUrl` exists.

Keep the grid as it is (`repeat(auto-fill, minmax(min(170px,100%),1fr))`); the user likes it.

## Files in scope

- `apps/web/src/components/sets/set-album.tsx`: the new card, year group heading and legend changes.
- `apps/web/src/app/sets/[id]/page.tsx`: the header block, the toolbar, the ⋯ set-actions menu and the delete dialog copy. The header and toolbar are shared with the List view, which is intended.
- `apps/web/src/components/ui/confirm-dialog.tsx`: add a `variant="danger"` prop (red confirm button). Its `description` is already a `ReactNode`.
- `apps/web/src/lib/i18n/locales/en.ts` and `es.ts`: new and changed keys (below). `es.ts` is typed against `en.ts`, so add every key to both.
- Tests: `components/sets/set-album.test.tsx`, `app/sets/[id]/album-view.test.tsx`, `app/sets/[id]/album-edge-cases.test.tsx`, plus any set-editor test that clicks `set-editor-delete-button`, `set-editor-download-missing` or `set-editor-print-missing` directly (those controls move into the menu).

Out of scope: the coin detail page, image re-hosting or uploads (forbidden by the CLAUDE.md scope rules), drag-and-drop ordering, and any API change. Everything here is web-only.

## Tokens

Use the Tailwind tokens from `apps/web/src/app/globals.css`. Don't hard-code the hexes shown in the reference markup.

| Use | Hex in mock | Token |
|---|---|---|
| Page background | `#f3f2f2` | `bg-bg` |
| Owned card fill | `#fff3e4` | `bg-accent-100` |
| Owned card border | `#e1ad66` | `border-accent-400` |
| Owned photo well | `#ffe3bf` | `bg-accent-200` |
| Owned check fill, progress bar, hover border | `#b68235` | `bg-accent` / `border-accent` |
| Owned status text, link hover, focus ring, primary button | `#7d5411` | `accent-700` |
| Key-date pill | `#5a3b0a` on `#fff3e4` | `bg-accent-800 text-accent-100` |
| Missing card fill | `#f8f4f4` | `bg-neutral-100` |
| Missing card border | `#d7d3d3` | `border-neutral-300` |
| Missing photo well | `#eae7e7` | `bg-neutral-200` |
| Missing check (dashed) | `#9b9797` | `border-neutral-500 text-neutral-500` |
| Secondary text | `#605d5d` | `text-neutral-700` (not `neutral-600`: it fails 4.5:1 on `bg`) |
| Dividers | 16% text | `border-divider` |
| Radii | 7px / 4px | `rounded-[var(--radius-lg)]` / `rounded-[var(--radius-md)]` |
| Shadows | | `shadow-sm` at rest (owned only), `shadow-md` on hover |
| Danger (delete) | `#a3271f` | new token `--color-danger: #a3271f` in `@theme` (white text on it is above 4.5:1) |

Fonts: headings use `font-[family-name:var(--font-heading)]` (Cormorant Garamond, 600), body uses IBM Plex Sans, and counts and percentages use `font-mono` (IBM Plex Mono).

## Page layout (top to bottom)

1. **Header block** (flex, wraps; title left, progress right, bottom-aligned):
   - Breadcrumb "My sets" (13px, `neutral-700`, link to the user's sets list). Show it only to the owner. For canonical or public sets, use the existing back-link pattern.
   - `h1` with the set name, Cormorant 40px/1.1, weight 600.
   - Subtitle (description, if any), 15px, `neutral-700`.
   - Progress (280px wide): "**4** of 12 owned" (number in mono 20px) and "33%" in mono `accent-700` on the right, then an 8px bar (track `neutral-300`, fill `accent`, radius 4px). Use `role="progressbar"` with `aria-valuenow` and an `aria-label` of "Set completion". This replaces the plain `set-editor-completion` percentage text (keep that test id on the percentage).
2. **Toolbar** (one row that wraps, `border-b border-divider`, 20px bottom padding):
   - Left: two segmented controls, each a `neutral-200`-ish track (`bg-surface`, 3px padding, radius 7px) with buttons 38px tall and the active button white with `shadow-sm`:
     - Show: "All coins · 12" and "Missing · 8" (`aria-pressed`; reuse `set-editor-show-all-toggle` / `set-editor-show-missing-toggle` or whatever ids exist).
     - View: List / Album (the existing `SetViewSwitch`, restyled).
   - Right: the primary "+ Add coins" button (44px tall, `bg-accent-700 text-white`, radius 4px; opens the existing Sheet) and a 44×44 "⋯" icon button (`aria-label="Set actions"`, `aria-haspopup="menu"`, `aria-expanded`). The ⋯ button appears **only when `isOwner`**.
3. **Year groups**: a row with the `h2` year (Cormorant 26px), a mono count "1/3" (`neutral-700`, 13px), and a 1px divider line filling the rest of the row. The grid sits below with a 14px gap.
4. **Legend:** remove the Owned/Missing/Key-date legend, because the cards now explain themselves. Keep the "Not in this set" blank-cell legend item, shown only when `showBlankLegend` (mint-mark table pages).
5. Footer unchanged.

## The card

Structure (`<li>`, a vertical flex column, `overflow-hidden`, radius 7px, 1px border):

```
┌──────────────────────────┐
│  [★ Key date]       (✓)  │  ← photo well, aspect-ratio 4/3
│         ( coin )         │     coin image ≈58% of well width, round
│                          │
├──────────────────────────┤
│ Donetsk Oblast           │  ← title link, 15px semibold, 1.3 line-height
│ 10 Hryvnias              │  ← denomination, 13px neutral-700
│ In collection        →   │  ← status 12px (+ arrow on hover)
└──────────────────────────┘
```

Body padding is `12px 14px 14px`, and the status row has an 8px top margin.

**Content:**

- Title: what `getAlbumCardText(coin).title` returns today.
- Denomination: the coin's denomination (e.g. "10 Hryvnias").
- **Drop the year from the card**: the group heading already shows it. The one exception is the visitor state (below), where the status line is replaced by the year, but only on mint-mark table pages where rows aren't grouped by year. On year-grouped pages, visitors see no status line at all.
- Eyebrow hoisting (`getSharedEyebrow`) stays as it is.

**Photo well:**

- If `coin.imageUrl` exists: `<img src={imageUrl} alt="" loading="lazy">`, `rounded-full object-contain`, width 58%, `aspect-square`, centered. These are hotlinked Wikimedia images; don't proxy or rehost them.
- If there's no image: the placeholder disc from the mock (a `neutral-300` circle with a 3px `neutral-400` border, a thin inner ring, the Cormorant numeral from `getDenominationNumeral()` at 34px, and the currency word in tiny tracked caps, if you have it; otherwise just the numeral).
- Owned: full color, `shadow-md` on the disc.
- Missing: `opacity-50 grayscale`.

**States:**

| | Owned | Missing |
|---|---|---|
| Card | `bg-accent-100 border-accent-400 shadow-sm` | `bg-neutral-100 border-neutral-300` |
| Photo well | `bg-accent-200` | `bg-neutral-200` |
| Photo | full color | `opacity-50 grayscale` |
| Check (32px visual, 44px hit area) | filled `bg-accent text-white`, 2px white border | `bg-white/85 text-neutral-500`, 1.5px **dashed** `neutral-500` border |
| Status text | "In collection", 12px, weight 500, `accent-700` | "Missing", 12px, `neutral-700` |

- **Key date:** a pill "★ Key date" at the top-left of the photo well (`top-2.5 left-2.5`, `bg-accent-800 text-accent-100`, 11px, weight 500, fully rounded). It replaces the current in-body badge.
- **Visitor (`!isOwner`):** no check button, and the photo stays at full strength even for coins the owner is missing. A visitor doesn't need gap emphasis, and the owner's gaps aren't theirs. Use the missing-card neutral fill for every card.
- **"Missing" filter on (`gapOnly`):** **hide** owned cards; don't dim them. The current code renders them at `opacity-40`. Year groups that end up empty disappear. If every coin is owned, show a centered empty message, "Nothing missing — this set is complete." (new key), on a `bg-surface` panel. Update the `data-muted` tests accordingly.

**Whole card is a link to the coin page** (`/catalog/{coin.id}`). Keep the current stretched-link pattern (`after:absolute after:inset-0` on the title `<Link>`), with the `<li>` `relative`. On hover or `focus-within`:

- the card moves up 2px (`-translate-y-0.5`), with `shadow-md` and `border-accent`;
- the title turns `accent-700` and underlines;
- the photo scales to 1.05 (200ms);
- a 16px "→" arrow fades in at the right end of the status row (`accent-700`, `aria-hidden`).

All transitions are about 150ms; wrap the movement in `motion-safe:`. The focus ring goes on the link's `::after` (2px `accent-700`, 2px offset).

**The check button sits above the stretched link** (`absolute top-1 right-1 z-10`, 44×44 transparent hit area with the 32px visual circle inside), so toggling never navigates. Keep `aria-pressed`, `aria-busy`, `disabled` while pending, and the existing `setAlbum.markOwned` / `markMissing` labels.

**Mint-mark table pages** (`!isNoMintMarkPage`): use the same card inside table cells, and raise the cell `min-w` to `172px`.

## Set actions menu (owner only)

The ⋯ button opens a menu anchored below its right edge: 240px wide, white, `border-neutral-300`, radius 7px, `shadow-lg`, 6px padding. Items are 40px tall, 14px, with a 16px stroke icon and a 10px gap. It closes on Escape, outside click or item click. Use proper `role="menu"` / `menuitem` and arrow-key navigation, or a disclosure with plain buttons if that's simpler; either way, keyboard must work.

1. **Rename set**: focuses the existing name editing. Keep the inline `set-editor-name-input` behaviour; this item just focuses and selects it.
2. **Download missing list (CSV)**: calls `downloadMissingCsv(gaps, set.name)`. Disabled when nothing is missing.
3. **Print missing list**: the link to `/sets/{id}/missing`. Disabled when nothing is missing.
4. A 1px `neutral-200` divider.
5. **Delete set…**: in `text-danger` with weight 500. Opens the confirm dialog.

Keep the existing test ids on these controls (`set-editor-download-missing`, `set-editor-print-missing`, `set-editor-delete-button`) so tests only need to open the menu first.

## Delete confirmation

Use `ConfirmDialog` with the new `variant="danger"`:

- Title: `Delete “{name}”?` (Cormorant 26px)
- Body: "The set and its list of {count} coins will be removed. This can't be undone."
- Reassurance note (an `accent-100` panel, `accent-800` text, 12×14 padding, radius 4px): "Your collection is safe: the {owned} coins you own from this set stay marked as owned." This is true by design, because `Ownership` rows aren't tied to sets and deleting a set never touches them. Show this note only when `owned > 0`.
- Buttons: Cancel (white, `border-neutral-400`) and **Delete set** (`bg-danger text-white`), both 44px tall, right-aligned.

After a successful delete, keep the existing `router.push('/dashboard')`, and show a one-time `role="status"` notice there: "“{name}” was deleted. The coins you own from it are still in your collection." Mirror the `account-deleted-notice` pattern (a sessionStorage flag consumed on mount). The mock shows this as a full-page message, but the notice on the dashboard is the intended implementation.

## i18n keys

Add or change these in **both** `en.ts` and `es.ts` (in Spanish, a set is "colección", following the existing strings):

| Key | en | es |
|---|---|---|
| `setAlbum.statusOwned` | In collection | En tu colección |
| `setAlbum.statusMissing` | Missing | Falta |
| `setAlbum.allOwned` | Nothing missing — this set is complete. | No falta nada: esta colección está completa. |
| `setEditor.progressLabel` | Set completion | Progreso de la colección |
| `setEditor.ownedOf` | {owned} of {total} owned | {owned} de {total} conseguidas |
| `setEditor.actionsMenu` | Set actions | Acciones de la colección |
| `setEditor.renameAction` | Rename set | Renombrar colección |
| `setEditor.deleteAction` | Delete set… | Eliminar colección… |
| `setEditor.deleteConfirmTitle` (change) | Delete “{name}”? | ¿Eliminar «{name}»? |
| `setEditor.deleteConfirmMessage` (change) | The set and its list of {count} coins will be removed. This can't be undone. | Se eliminará la colección y su lista de {count} monedas. Esta acción no se puede deshacer. |
| `setEditor.deleteConfirmSafe` | Your collection is safe: the {owned} coins you own from this set stay marked as owned. | Tus monedas están a salvo: las {owned} monedas que tienes de esta colección siguen marcadas como tuyas. |
| `setEditor.deletedNotice` | “{name}” was deleted. The coins you own from it are still in your collection. | Se eliminó «{name}». Las monedas que tienes de ella siguen en tu colección. |

You can drop `setAlbum.legendOwned`, `legendMissing`, `legendKeyDate` and `keyDateBadge` if nothing uses them any more (check `dictionaries.test.ts`). Keep `legendBlank`.

## Accessibility checklist

- Hit areas of at least 44px for the check, the ⋯ button, Add coins and the dialog buttons.
- The card's accessible name stays `formatAlbumCardLabel(slot, words)`, which already says owned or missing.
- Owned and missing differ in lightness and border style (dashed), not just hue.
- Every text color is at least 4.5:1 on its background. Use `neutral-700` for secondary text, not `neutral-600`.
- The dialog keeps its existing Escape, overlay and focus behaviour, and gets `role="alertdialog"` for the danger variant.

## Done when

- [ ] The card matches `card-states.html` in all five states (hover, owned, missing, owned + key date, visitor).
- [ ] Owned and missing are distinguishable at a glance in a 12-coin set (e.g. Ukraine Commemorative 10 Hryvnias).
- [ ] Clicking anywhere on a card except the check opens `/catalog/{id}`, and clicking the check toggles ownership without navigating.
- [ ] The Missing filter hides owned coins, and an all-owned set shows the empty message.
- [ ] The ⋯ menu shows only for the owner, all four actions work, and the delete dialog shows the owned-coins reassurance.
- [ ] The new keys are in both `en.ts` and `es.ts`.
- [ ] Verification passes: `pnpm lint`, `pnpm --filter @coin-collector/shared build && pnpm --filter web typecheck && pnpm --filter web test`.
- [ ] Tick off with a short entry in `docs/history.md`.
