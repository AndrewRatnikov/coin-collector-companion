# New set flow redesign (2026-10-13)

Implementation brief for redesigning `/sets/new`. Reference markup: [`2026-10-13_new-set-flow/new-set.dc.html`](2026-10-13_new-set-flow/new-set.dc.html). It's a template with `{{holes}}`, `<sc-for>` and `<sc-if>`; the `renderVals()` script at the bottom holds the sample data and the per-state styles. Read it for exact values; it isn't runnable HTML.

**Status:** approved by Andrew, not yet implemented. Use the tokens table in [`2026-10-10_album-view.md`](2026-10-10_album-view.md); don't hard-code hexes.

## Problem

`apps/web/src/app/sets/new/page.tsx` is one long form doing three jobs at once:

- naming the set;
- choosing a mode and a source;
- hand-picking coins through a catalog picker plus an "In this set" list.

"Create Set" sits in the middle, above the pickers. Arriving from a Clone link (`?cloneFrom=canonical&cloneFromId=…`) still shows all three mode radios. "Canonical" is jargon. The source list shows bare names, and the page still uses the old blue, pre-design-system styling.

## The new flow: two steps on one route

There is still one route, `/sets/new`. The step lives in component state, and the URL params pick the starting step.

**Step indicator** (below the `h1`): "① Starting point — ② Name & create".

- Done step: a 28px `bg-accent` circle with ✓.
- Current step: `bg-accent-700` with a white mono number.
- Upcoming step: a 1.5px `neutral-500` ring.
- They're joined by a 40px `neutral-400` line.
- Step 1 is a button, so you can go back. Use `aria-current="step"` on the current step.

Page head: the breadcrumb "My sets / New set" (13px `neutral-700`) and the `h1` "New set" (Cormorant 40px, weight 600). Container `max-w-[1200px]`.

### Step 1: Starting point

The heading is "How do you want to start?" (Cormorant 26px). Below it, three large option cards in a `role="radiogroup"` with `grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))` and a 14px gap. Each card is a `<button role="radio" aria-checked>` with 18–19px padding, radius 7px, a 16px semibold title and a 14px `neutral-800` description.

- Selected: 2px `border-accent` on `bg-accent-100`.
- Unselected: 1px `border-neutral-300` on white.
- Hover: `border-accent` with `shadow-md`.

| Option | Title | Description | Badge |
|---|---|---|---|
| `canonical` | Curated checklist | A complete series list maintained by Coin Collector Companion. The easiest way to start. | "Recommended" pill (`bg-accent-800 text-accent-100`, 11px) |
| `public` | Copy a collector's set | Start from a set another collector has shared. | n/a |
| `blank` | Start empty | Pick every coin yourself from the catalog. | n/a |

**Below the cards, depending on the selected option:**

- **Curated:**
  - The subheading "Choose a checklist" (12px, weight 600, uppercase, 0.06em, `neutral-800`).
  - A grid of source cards (`repeat(auto-fill, minmax(min(340px,100%),1fr))`, 14px gap). Each card is a `<button>`: white, `border-neutral-300`, radius 7px, padding 18px. It holds:
    - the name in Cormorant 22px;
    - the description in 13px `neutral-800`, clamped to 2 lines;
    - mono meta chips (`bg-surface`, radius 4px, 12px): "{coinCount} coins".
  - Clicking a card picks that source and moves to step 2.
- **Public:** a search input ("Search public sets by name", same style as the catalog brief) that filters the already-loaded `usePublicSets` list on the client, then the same card grid (name plus "{coinCount} coins"). Clicking a card moves to step 2.
- **Blank:** a `bg-surface` panel with "You'll create an empty set, then add coins from the catalog one by one." and a primary **Continue** button, which moves to step 2.

### Step 2: Name & create

A flex row that wraps, with a 32px gap.

**Left** (`flex: 999 1 560px; min-width: 0`):

- **Source card:** white, `border-neutral-300`, radius 7px, padding 22px.
  - An eyebrow (12px uppercase `neutral-700`): "Curated checklist" / "Copying a collector's set" / "Starting from".
  - A **Change** text button (`accent-700`, underlined) in the top-right corner, which goes back to step 1 with the current option still selected.
  - The name in Cormorant 28px.
  - A description: the source description; for public sets, "You get your own copy. Changes you make won't affect the original."; for blank, "After creating it, use "Add coins" to pick coins from the catalog."
  - Meta chips: "{n} coins", "{minYear}–{maxYear}" and the country, all derived from the detail's coins. If the coins span several countries, show "{k} countries".
- **Coin preview** (curated and public only): the heading "Coins you'll be tracking" and, on the right, "You can add or remove coins after creating the set." (13px `neutral-700`). Below that, a read-only list box (`bg-neutral-100`, `border-neutral-300`, radius 7px):
  - year group headers in Cormorant 18px;
  - the rows in a grid (`repeat(auto-fill, minmax(min(240px,100%),1fr))`), each with a 32px numeral disc (or `imageUrl` when present), the title from `getAlbumCardText(coin).title`, and the denomination at 12px.
  - **Cap the preview at 60 coins** and finish with "+ {rest} more" for large checklists (Ukraine Circulation Coins has 187).
  - Show a `ListSkeleton` while the detail loads.

**Right** `<aside>` (`flex: 1 1 320px; max-width: 400px`, white, `border-neutral-300`, radius 7px, padding 22px, 16px gap):

- `h2` "Name your set" (Cormorant 24px).
- A labelled input, "Set name" (44px tall, `border-neutral-400`, the focus ring from the catalog brief, `required`). It's pre-filled with the source name (resolved for the current locale) the first time a source is picked. Don't overwrite it after the user has typed. It's empty for blank sets.
- A helper line: "Sets are public: other collectors can view and copy them." (13px `neutral-700`).
- The primary submit button, full width, 48px, `bg-accent-700` with white text: "Create set with {n} coins", or "Create set" for blank. While submitting: `disabled` with the label "Creating…".
- "Cancel": a link back to where the user came from. That's `/sets/canonical/{id}` or `/sets/public/{id}` when cloning, otherwise `/dashboard`.
- A divider, then "What happens next" (12px uppercase) and an `<ol>` (13px):
  1. "Your new set opens in album view." (blank: "Your empty set opens, ready for "Add coins".")
  2. "Tick the coins you already own. The gaps show what to look for."
  3. "Add or remove coins any time."
- Errors (`role="alert"`) go above the button.

Under 720px the two columns stack, with the aside first, so the name field and Create button stay above the long preview.

## Entry points and routing

- `?cloneFrom=canonical&cloneFromId={id}` → step 2, curated, that source. This is the link on `sets/canonical/[id]`.
- `?cloneFrom=user&cloneFromId={id}` → step 2, public, that source. This is the link on `sets/public/[id]`.
- No params → step 1 with **Curated** pre-selected. This is the link on the dashboard.
- An unknown or missing id → step 1 with an inline note: "That set couldn't be found. Choose another starting point."

## Behaviour changes (decided)

- **Remove coin picking from creation.** Delete the catalog picker panel, the "In this set" pending list, the `pendingCoins` / `baselineIds` / `createdSet` patch-after-create effect, and `usePatchSetCoins` and `useCatalog` from this page. Creating sends only `{ name }` or `{ name, cloneFrom }`, and on success goes to `/sets/{id}`. People edit coins afterwards with the set page's existing "Add coins" sheet. That gives one code path, the full-clone behaviour already in `SetsService`, and none of the two-request race.
- The `CatalogFilterForm` import goes away from this page. The component stays, because the set editor still uses it.

## API (small, no schema change)

`CanonicalSetSummary` has no coin count, and the step-1 cards need one.

- Add `coinCount: number` to `CanonicalSetSummary` in `packages/shared`. Fill it in the canonical-sets list query with Prisma `_count: { select: { coins: true } }` (check the relation name on `CanonicalSet`).
- Do the same for the public-sets list summary the page uses.
- Update the API specs that assert these response shapes.
- Years and country come from the detail endpoint (step 2), so the list doesn't need them.

## i18n

In both `en.ts` and `es.ts`:

- Replace the `setNew.*` keys that are no longer used: `modeBlank`, `modeCanonical`, `modePublic`, `chooseCanonical`, `choosePublic`, `inThisSet`, `nothingAdded`, `add`, `remove`, `createSet`, `addFromCatalogue`, and the select placeholders, if nothing else references them.
- Add keys for every string in this brief: steps, option titles and descriptions, "Recommended", "Choose a checklist", "Choose a collector's set", the search placeholder, "Continue", the eyebrows, "Change", "Coins you'll be tracking", the preview note, "+ {count} more", "Name your set", "Set name", the public-sets helper, "Create set with {count} coins", "Create set", "Creating…", "Cancel", "What happens next" and its three lines (plus the blank variant), and the not-found note.
- Spanish follows `es.ts`'s existing tone ("colección" for set, "lista curada" for checklist).

## Tests

Rewrite `apps/web/src/app/sets/new/page.test.tsx`. Keep `set-new-page`, `set-new-name-input`, `set-new-submit` and `set-new-error`. Drop the picker and pending-list test ids. Add `set-new-step-{1|2}`, `set-new-option-{canonical|public|blank}`, `set-new-source-card`, `set-new-change` and `set-new-preview`. Cover:

- landing on step 2 from each clone param, and on step 1 without params;
- the name pre-filled from the source but not overwritten after typing;
- the button label shows the coin count;
- Change goes back to step 1;
- the blank flow;
- the submit body (no follow-up patch call) and the redirect to `/sets/{id}`;
- the error shown with `role="alert"`;
- the not-found id note;
- the preview capped at 60 with "+ n more".

Also update the API specs for `coinCount`.

## Done when

- [ ] `/sets/new?cloneFrom=canonical&cloneFromId=…` opens on step 2 with the source card, preview, pre-filled name and "Create set with N coins".
- [ ] `/sets/new` opens on step 1. All three options work, and each reaches step 2.
- [ ] Creating sends one request and lands on the new set.
- [ ] No coin picker remains on this page, and the set editor's Add-coins sheet is unchanged.
- [ ] It works at phone width, with the aside above the preview.
- [ ] The new keys are in both `en.ts` and `es.ts`.
- [ ] Verification passes: `pnpm lint`, `pnpm --filter @coin-collector/shared build`, typecheck for shared, api and web, `pnpm --filter api exec prisma generate && pnpm --filter api test`, `pnpm --filter web test`.
- [ ] A short entry is added to `docs/history.md`.
