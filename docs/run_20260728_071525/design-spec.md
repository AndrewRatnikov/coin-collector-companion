# Coin Collector Companion — Design Spec (from claude.ai/design)

Source: claude.ai/design project `4bb9b934-c30a-4a95-8705-166acd540eae` ("Classical Tokens Design Component"), file `Coin Collector Companion.dc.html`, design system `classical-027685d1-b6ce-4878-904e-9ede4c468126`. This mock is a single-file `.dc.html` component (parsed by `support.js`): an `<x-dc>` HTML template with `{{ binding }}` placeholders, `sc-if`/`sc-for` control-flow tags, and a sibling `<script data-dc-script>` block containing a `class Component extends DCLogic` with real mock data and view logic (fake in-memory state — not wired to a backend). Everything below is derived from reading that template and script in full, plus the design system's `styles.css` and `readme.md`.

## Design tokens

Exact values, verbatim from `_ds/classical-027685d1-b6ce-4878-904e-9ede4c468126/styles.css`:

```css
--color-bg: #f3f2f2;
--color-surface: #eae9e9;
--color-text: #201f1d;
--color-accent: #b68235;
--color-accent-2: #ac803e;
--color-divider: color-mix(in srgb, #201f1d 16%, transparent);

--color-neutral-100: #f8f4f4;
--color-neutral-200: #eae7e7;
--color-neutral-300: #d7d3d3;
--color-neutral-400: #bab6b6;
--color-neutral-500: #9b9797;
--color-neutral-600: #7d7979;
--color-neutral-700: #605d5d;
--color-neutral-800: #444141;
--color-neutral-900: #2d2b2b;

--color-accent-100..900: #fff3e4, #ffe3bf, #facb8d, #e1ad66, #c28d41, #a06f24, #7d5411, #5a3b0a, #3a270d;
--color-accent-2-100..900: #fff3e4, #ffe3be, #f5cd96, #dbaf70, #bc8f4e, #9b7232, #79561f, #573d14, #382810;
/* accent-2 is a machine-derived stand-in — treat as the same role as accent (mono color scheme, one accent only) */

--font-heading: "Cormorant Garamond", system-ui, sans-serif;
--font-heading-weight: 600; /* semibold is the ceiling for headings; bold is never used */
--font-body: "Lora", system-ui, sans-serif;

--space-1..8: 4.6px, 9.2px, 13.8px, 18.4px, 27.6px, 36.8px; /* 1,2,3,4,6,8 */
--radius-sm: 2px; --radius-md: 4px; --radius-lg: 7px;
--shadow-sm: 0 1px 2px color-mix(in srgb, #2d2b2b 14%, transparent);
--shadow-md: 0 3px 10px color-mix(in srgb, #2d2b2b 16%, transparent);
--shadow-lg: 0 12px 32px color-mix(in srgb, #2d2b2b 22%, transparent);
```

**Font override in this specific mock:** the design system's own default body font is Lora (`--font-body`), but the `Coin Collector Companion.dc.html` page overrides `body { font-family: 'IBM Plex Sans', system-ui, sans-serif; font-size: 14px; line-height: 1.55 }` and uses `'IBM Plex Mono', ui-monospace, monospace` for all numeric/tabular text (prices, years, counts, percentages, pagination). Headings still use `var(--font-heading)` (Cormorant Garamond, weight 600) unchanged. Load both Google Fonts families: `IBM Plex Sans:wght@400;450;500` and `IBM Plex Mono:wght@400;500`, alongside the DS's own Cormorant Garamond import. **Implement the app with this override** (IBM Plex Sans body / IBM Plex Mono numerals / Cormorant Garamond headings) — it is the actual approved screen design, not the DS's generic default.

**Primary button discrepancy:** `readme.md` documents `.btn-primary` as an *outline only* style ("the primary is an accent outline, never a fill... Do not fill cards or buttons with solid accent color"). The actual mock's primary CTAs (Mark as owned, Clone this set, Create Set, auth submit) are **solid-filled**: `background: var(--color-accent); color: var(--color-bg); border: 0; border-radius: 2px; padding: 13px 26px; font-size: 12px; letter-spacing: .1em; text-transform: uppercase`, hover `background: color-mix(in srgb, var(--color-accent) 86%, #000)`. **Follow the mock literally** for this app's primary buttons (solid accent fill, uppercase micro-label) — treat it as an intentional per-screen override of the generic DS convention.

Other recurring visual patterns actually used in the mock:
- Hairline dividers everywhere: `1px solid var(--color-divider)`.
- Row hover: `background: color-mix(in srgb, var(--color-text) 3%, transparent)`.
- "Eyebrow" labels: 10–11px, uppercase, `letter-spacing: .14em–.16em`, `color: var(--color-neutral-600)`.
- Circular coin "face" avatars: `border-radius: 50%`, `background: var(--color-surface)`, `outline: 1px solid var(--color-divider)` (or `--color-neutral-400` for missing coins in the editor), sizes vary by context (36–52px), showing a small monospace glyph (see `face()` below).
- Progress bars: thin (5px on Dashboard, 8px on Set Editor) track `var(--color-neutral-200)`, fill `var(--color-accent)`, width set inline as a `%` string.
- Numbers/prices/years/percentages are `font-variant-numeric: tabular-nums` in IBM Plex Mono.
- Page container: `width: min(1080px, 100%); margin: 0 auto; padding: 0 clamp(20px,5vw,48px)`. Auth screens use a narrower `min(420px,100%)` centered column.
- Icons are hand-rolled inline SVGs (star outline/filled for key-dates, filled-circle+checkmark for "Owned", outline-circle+dash for "Missing") rather than the DS's suggested Lucide set — reasonable to implement as inline SVG matching the exact paths given, or swap for equivalent Lucide icons (`Star`, `CheckCircle2`, `CircleMinus`) if that's preferred; visually equivalent either way (see Open Questions).

## Global layout

Sticky header (`position: sticky; top:0; z-index:9; background: var(--color-bg)`), max-width 1080px inner row, `display:flex; align-items:baseline; gap:24px; flex-wrap:wrap`:
- Brand button "Coin Collector Companion" (Cormorant Garamond, weight 600, 19px) → navigates Home. Always leftmost, `margin-right:auto`.
- Always-visible nav links (13px, 70% opacity, full opacity + accent color on hover): **Catalog**, **Canonical Sets**, **Public Sets**.
- If signed in: a `border-left` divider then **Dashboard**, **Collection**, **Log out** (log out is `color: var(--color-neutral-600)`, no dim opacity).
- If signed out: a `border-left` divider then **Log in**, **Sign up**.
- 1px divider line under the whole header.

Below the header, each route renders exactly one of the views below inside the same 1080px container (or the 420px auth container). No client-side routing library is implied by the mock — it's a single-page state machine (`route` object `{n, p}` in in-memory state) — the real app uses actual Next.js routes, one per view, listed per-view below.

## Per-view breakdown

### `isHome` → `apps/web/src/app/page.tsx`
Purpose: landing/marketing page, no account needed.
- Eyebrow: "Est. catalogue & personal ledger"
- H1 (serif, weight 400, clamp 40–68px): "A quiet place to record what you have — and what you are still looking for."
- Paragraph: "Define a set on your own terms, mark the coins you own, and see the gaps that remain. Browsing needs no account."
- Three stacked link-rows (top border on the group, bottom border per row), each: label left, monospace count right, hover → accent color:
  - "Browse the catalogue" — `{{ coinTotal }} coins` → Catalog
  - "Browse canonical sets" — `{{ canonicalTotal }} sets` → Canonical Sets
  - "Browse collectors' sets" — `{{ publicTotal }} sets` → Public Sets
- No auth gating; identical for signed in/out (nav differs only in header).

### `isCatalog` → `apps/web/src/app/catalog/page.tsx`
Purpose: browse/search the full coin catalogue (public, no auth required).
- H1 "Catalogue" + `{{ catCount }} entries` (monospace, right-aligned) + divider.
- Filter row: Country `<select>` (`fCountry`/`onFCountry`, options from `countries` = distinct `c` values sorted), Denomination `<select>` (`fDenom`/`onFDenom`, from `denoms` = distinct `d` values sorted), free-text "Coin name or series" input (`fQ`/`onFQ`, placeholder "e.g. wheat cent"), "Year from"/"To" number-ish text inputs (`fFrom`/`fTo`, monospace), "Clear" link-button (`onClearFilters`, resets all filters + page 1).
- List: one row per `catRows[i]` (paginated, 8/page): circular avatar showing `coin.face`, name (`coin.name` = `"{country} {denomination} ({year}{ mint})"`) + sub (`coin.sub` = variety label or series name), key-date star (accent-filled star if missing+key-date, neutral outline star if owned+key-date — controlled by `showKeyDateStars` design prop, default on), "Owned" badge (checkmark-in-circle, neutral-800 fill) if owned. Whole row is a button → Coin Detail.
- Empty state (`catEmpty`): centered "No coins match these filters."
- Pagination (`catHasPages`): centered monospace page numbers, active page underlined text, inactive pages are accent-hover links (`p.onClick`).

### `isCoin` → `apps/web/src/app/catalog/[coinId]/page.tsx`
Purpose: single coin detail — catalogue metadata + owned/missing action.
- "← Catalogue" back link.
- Two-column responsive grid: left = square bordered "plate" placeholder (circular face avatar inside, `coinFace`) with caption "Plate not yet photographed"; right = content.
- Eyebrow "Catalogue entry", H1 `{{ coinName }}`, sub `{{ coinSub }}`.
- Metadata table (`coinMeta`, 6 rows): Country, Denomination, Year, Mint mark (`—` if none), Variety (`—` if none), Series, Key date (Yes/No) — each row `label | value`, value in monospace tabular-nums.
- If signed in (`coinCanOwn`): missing → "Mark as owned" solid accent button (`coinToggle`); owned → "In your collection" badge (checkmark) + "Remove from collection" link (`coinToggle`).
- If signed out (`coinSignedOut`): "Log in to record this coin in your collection." with a Log in link.
- If the coin appears in any of the user's own sets (`coinHasSets`, signed-in only): "Appears in your sets" section listing set names (each → that set's Set Editor, `s.onOpen`).

### `isCanonical` → `apps/web/src/app/sets/canonical/page.tsx`
Purpose: list of 5 official/curated sets maintained by the catalogue.
- H1 "Canonical sets" + paragraph "Standard collecting sets, maintained by the catalogue. Clone one to begin your own copy."
- List rows (`canonicalRows`): name (21px serif/heading), desc, and `{{ count }} coins` right-aligned monospace. Whole row → Set Detail (canonical variant).
- No pagination (only 5 canonical sets; not paginated in the mock).

### `isPublic` → `apps/web/src/app/sets/public/page.tsx`
Purpose: browse all collectors' (other users') sets, all sets are public.
- H1 "Collectors' sets" + paragraph "Every set kept in the companion is public. Browse them, then clone any one as a starting point."
- List rows (`publicRows`, paginated 4/page): name, desc, "Kept by {{ s.author }}" (12px, neutral-500), count right-aligned. Whole row → Set Detail (public variant).
- Pagination (`pubHasPages`/`pubPages`) identical pattern to Catalog.

### `isSetDetail` → `apps/web/src/app/sets/canonical/[id]/page.tsx` (canonical) and `apps/web/src/app/sets/public/[id]/page.tsx` (public)
One shared template, gated by whether the route resolved a canonical or public set (`isCanonDetail` / `isPubDetail` internally); both repo routes should implement this same view with the copy differences below.
- Back link: "← Canonical sets" (canonical) or "← Collectors' sets" (public), styled `'` as a right single quote (’).
- Kicker: "Canonical set" (canonical) or "Collector's set — kept by {author}" (public).
- H1 `{{ detailName }}`, paragraph `{{ detailDesc }}`.
- Action row: "Clone this set" solid accent button if signed in (`detailClone` — copies the set's coin ids into a brand-new entry in the user's own `sets`, origin label "Cloned from a canonical set" / "Cloned from {author}", then navigates to that new set's Set Editor); if signed out, "Log in to clone this set into your own collection." prompt instead. Always shows `{{ detailCount }} coins`. Public sets only, signed in only: "You already own {{ detailOverlap }}" (e.g. "3 of 8") — overlap between the viewer's owned coins and this set's ids.
- Coin list (`detailRows`): same row layout as Catalog, plus — **public sets only, signed in only** — an explicit "Owned"/"Missing" badge per row (canonical sets and signed-out viewers don't show this per-row badge, only the key-date star).

### `isAuth` → `apps/web/src/app/login/page.tsx` (login mode) and `apps/web/src/app/signup/page.tsx` (signup mode)
- Centered narrow (420px) column. Brand text "Coin Collector Companion" (22px), divider, then H1 = `{{ authTitle }}` ("Log in" / "Create an account").
- Email field (label "Email", `authEmail`/`onAuthEmail`), Password field (label "Password", `type=password`, `authPass`/`onAuthPass`).
- Full-width solid accent submit button, label = `{{ authAction }}` ("Log in" / "Sign up").
- Switch line below: `{{ authSwitchText }}` ("No account yet?" / "Already keeping a collection?") + link `{{ authSwitchLink }}` ("Sign up" / "Log in") → toggles to the other auth route.
- Mock behavior note: `onAuthSubmit` unconditionally sets `signedIn = true` and routes to Dashboard — there is no real validation, no error states, and no distinction between login/signup outcomes in the design. The real implementation should wire this to the app's actual `apps/api` auth endpoints (`auth.controller.ts`/`auth.service.ts` already exist in the repo) rather than replicate the mock's always-succeeds behavior.

### `isDashboard` → `apps/web/src/app/dashboard/page.tsx`
Purpose: signed-in user's home — overview of their own sets. Requires auth (redirects to login if signed out).
- H1 "Your sets" + "+ New Set" link (→ New Set) top-right.
- Three stat tiles, large serif numerals (52px): Sets (`statSets`), Coins owned (`statOwned`), Average completion (`statAvg`, with a smaller "%" suffix).
- List rows (`setRows`) — one per user set: name (21px), "{owned} / {total} owned" (monospace label), thin 5px progress bar (accent fill, neutral-200 track, width = `pct%`), percent number right-aligned (15px monospace). Whole row → that set's Set Editor.

### `isCollection` → `apps/web/src/app/collection/page.tsx`
Purpose: flat view of every coin the signed-in user owns, independent of any set. Requires auth.
- H1 "Collection" + paragraph "Every coin you have recorded, independent of any set." + `{{ colCount }} coins` right-aligned.
- Filters: Country select (`colCountry`/`onColCountry`, same countries list as Catalog), Year text input (`colYear`/`onColYear` — **prefix match** on the year string, not a range: `String(year).indexOf(query) === 0`).
- Flat row list (`colRows`, no pagination, no grouping): smaller avatar (40px) + name + sub, right column shows `{{ year }} {{ mint }}` in monospace instead of a badge.
- Empty state (`colEmpty`): "Nothing recorded yet."

### `isNewSet` → `apps/web/src/app/sets/new/page.tsx`
Purpose: create a new user set, either from scratch or seeded by cloning a canonical/public set. Requires auth.
- H1 "New set" + paragraph "Begin from nothing, or take an existing set as your starting point." + divider.
- Radio group (`modes`, 3 options): "Start blank" / "Clone a canonical set" / "Clone a public set". Custom-styled radio dot (transparent vs accent fill) — native `<input type="radio">` visually hidden, styled span shows state.
- If mode ≠ blank (`showSource`): a source-picker list appears, label "Choose a canonical set" or "Choose a collector's set" (`sourceLabel`); rows show name, count, and a "Selected" tag on the currently-picked source (`sourceRows`, click → `s.onPick`, which sets `src`, pre-fills `ids` with that set's full coin list, and defaults the new set's name to the source's name if not yet typed).
- Set name input (large, heading font, placeholder "Lincoln Wheat Cents, 1909–1958") (`newName`/`onNewName`).
- Two-column section below a divider:
  - Left: "Add from the catalogue" — same filter controls as Catalog (country/denom/name/from/to), scrollable list (`pickerRows`, capped at 40 client-side, excludes coins already in the new set) with an "Add" link per row (`coin.onAdd`).
  - Right: "In this set — {{ newCount }}" — list of currently-added coins (`newRows`) each with a "Remove" link (`coin.onRemove`); empty state "Nothing added yet." (`newEmpty`); below the list, a solid accent "Create Set" button (`onCreateSet`) — creates the set (origin label depends on mode: "Started blank" / "Cloned from a canonical set" / "Cloned from a public set"), resets the New Set form, and navigates to the new set's Set Editor.

### `isEditor` → `apps/web/src/app/sets/[id]/page.tsx`
Purpose: the user's own set — rename it, see completion, and mark coins owned/missing grouped by decade. This is the most complex view and the mock's actual default landing route (`startRoute: 'seteditor'`, a preview-only knob — **the real app's default landing should be Home, not Set Editor**; see Open Questions). Requires auth.
- "← Your sets" back link (top-left) + origin label top-right (`edOrigin`, e.g. "Cloned from a canonical set", "Started blank", "Hand-picked").
- Editable set name: a plain `<input>` styled to look like a heading (transparent border, border appears on hover, accent border on focus) bound to `edName`/`onEdName` — renames the set live, no separate "save" step.
- Big stat row: huge serif percentage (`edPct`, up to 152px) + "%" + a "Complete" progress bar (8px, same track/fill pattern as Dashboard) + "{{ edOwned }} of {{ edTotal }} owned" (monospace).
- Filter toggle row (below a divider): "All {{ edTotal }} coins" vs "{{ edMissing }} missing" — exactly one is the active (underlined, non-clickable) label, the other is a clickable link that switches `gapOnly` (`onShowAll`/`onShowGap`). Right-aligned: "Add coins" / "Close picker" toggle (`onTogglePicker`).
- Empty state (`edEmpty`, whole set has 0 coins): "No coins yet — add some below."
- Coins grouped into decade accordions (`edGroups`, sorted ascending by decade): each group header is a full-width button with a "+"/"–" mark, decade label (e.g. "1910s"), and "{{ owned }} of {{ total }} owned" summary; click toggles collapsed state (persisted per set+decade in `collapsed` state). When `gapOnly` is on, groups with zero remaining rows after filtering are hidden entirely, and only missing coins render inside open groups.
  - **Missing coin row** (52px avatar, neutral-400 outline): name (21px) + key-date star + sub, "Missing" badge (outline circle+dash icon) + "Mark owned" link (`coin.onToggle`).
  - **Owned coin row** (38px avatar, indented 7px, divider outline): name in lighter weight (400) + neutral-700 color + key-date star (dimmer), "Owned" badge (filled circle+check) + "Undo" link (`coin.onToggle`).
- Inline "Add coins from the catalogue" picker (`edPickerOpen`): same filter controls + scrollable row list (`edPickerRows`, capped 40, excludes coins already in this set) with "Add" per row (`coin.onAdd` — appends directly to this set's `ids`, no separate confirm step).

## Notable interaction/state logic

- **Coin data model** (`coins`, generated in the component constructor — this is mock seed data, not something to hardcode verbatim in production, but useful as realistic fixture/seed data): each coin has `{id, c: country, d: denomination, y: year, m: mint mark ('' if none), s: series name, k: boolean isKeyDate, v: variety label}`. Series present: Lincoln Wheat Cent (USA, 1¢, 1909–1958, ~30 entries incl. 1909-S VDB, 1922 "No D", 1931-S, 1943 steel, 1955 doubled die), Buffalo Nickel (USA, 5¢, 1913–1938, incl. 1937-D "Three-Legged"), Mercury Dime (USA, 10¢, 1916–1945, incl. 1942/1 overdate), Morgan Dollar (USA, $1, 1878–1921, incl. CC mint coins), Presidential Dollar (USA, $1, 2007–2016, 6 named presidents), plus 8 standalone "animal on a coin" world coins (Canada, Australia, South Africa, Ireland, New Zealand, UK, India) each with a `v` (animal name) instead of a series grouping.
- `label(coin)` → `"{c} {d} ({y}{ m})"`; `face(coin)` → a short glyph derived from denomination: `¢` for Cent, `$` for Dollar, `R` for Rand, `₹` for Rupee, `/-` for Shilling, `¼d` for Farthing, else the numeral alone.
- **Canonical sets** (5, fixed): U.S. Presidents (all presidential dollars), Lincoln Wheat Cents 1909–1958 (full series), Buffalo Nickels 1913–1938 (full series), Mercury Dimes 1916–1945 (full series), Morgan Dollars (full series).
- **Public/collectors' sets** (6, fixed, each with an `author` display name): "Coins with animals on them" (the 8 animal coins), "Wheat cents my grandfather left me" (first 14 wheat cents), "Key dates only" (every coin flagged `k: true` across all series), "Carson City silver" (every coin with mint `CC`), "Wartime metals" (1943/1944 wheat cents + 1942 Mercury dime — filtered to only ids that actually exist), "One coin from every country" (one coin per country incl. a wheat cent).
- **User's own sets** seed data (`state.sets`, 4 example sets: s1 Lincoln Wheat Cents/cloned, s2 animal coins/hand-picked, s3 US Presidents/cloned, s4 Buffalo Nickels/started-blank-empty) plus `state.owned` (a fixed list of ~21 owned coin ids spanning multiple series/sets) — realistic fixture data for seeding a demo/dev environment, not literal requirements.
- **Filter matching** (`matches`, shared by Catalog / Collection-add-picker / New-Set picker / Editor-picker): country exact-match, denomination exact-match, free-text `q` substring match (case-insensitive) against `label + series + variety` combined, year `from`/`to` inclusive range on `y`. Collection's own filter is simpler: country exact-match + year **prefix** match (not range).
- **Pagination**: Catalog = 8/page, Public Sets list = 4/page; both use a simple `Math.ceil` page-count + `Array.from` page-number list, no "prev/next" arrows in the mock (numbers only). Coin pickers (New Set, Set Editor "add coins") are NOT paginated — they just slice to the first 40 filtered matches and rely on the scrollable `max-height` container.
- **Clone flow**: from a canonical or public Set Detail page, "Clone this set" copies the set's full `ids` array into a new entry in the signed-in user's `sets`, assigns an origin string, and navigates straight into that new set's Set Editor (no intermediate confirmation or naming step — it inherits the source's name, which the user can then rename inline in the Editor).
- **New Set vs Clone-from-detail**: these are two different creation paths that both land on the Set Editor. New Set additionally lets the user pick individual coins one at a time (from blank or as edits after choosing a source) before creating, whereas Clone-from-detail creates immediately with the full source set.
- **Owned/Missing toggle** (`toggle(id)`): a pure client-side add/remove against `state.owned`; used identically from Catalog rows, Coin Detail, Set Detail rows (implicitly via `coin.onToggle` on hover badges — actually Set Detail rows in the mock don't expose a direct toggle button, only Catalog/Collection/Coin-Detail/Set-Editor rows do), and Set Editor rows.
- **Decade grouping** in Set Editor: `Math.floor(year / 10) * 10` + "s" (e.g. 1910s), sorted ascending, collapse state keyed by `setId + decadeLabel` so it persists correctly per-set as you switch sets.
- **Auth gating**: signed-out users attempting `dashboard`, `collection`, `newset`, or the set editor are redirected to `login` (the mock does this via a route check, not a Next.js middleware — the real app already has `apps/web/src/components/auth/require-auth.tsx` for this, which should be reused rather than re-implemented).
- **Session/accent are the only "editor" props** in the mock (`signedIn` boolean, `startRoute` enum, `accent` color swatch picker, `showKeyDateStars` boolean) — these are design-tool preview knobs only, not real app config; ignore them except as documented above (accent color value, key-date star visibility as a real feature toggle if desired, though nothing in the PRD/repo suggests it needs to be user-configurable).

## Open questions / ambiguities for the Architect

1. **Primary button fill vs. outline** — the mock's solid-accent-fill primary buttons contradict the design system readme's outline-only `.btn-primary` convention. Recommendation: follow the mock (solid fill) since it's the specific approved screen design; flagged in case the Architect/user prefers strict adherence to the generic DS component instead.
2. **Icons**: hand-rolled inline SVG in the mock vs. the DS readme's "use Lucide icons throughout" guidance. Either is visually acceptable (paths given exactly in the per-view breakdown above); Lucide (`lucide-react`) would be more maintainable if it's already a dependency, otherwise inline SVG matching the given paths is fine and zero-dependency.
3. **Default landing route**: the mock's own `startRoute` preview default is the Set Editor (an artifact of the design tool's preview setup for showcasing that screen), but the real app almost certainly should default unauthenticated/root traffic to Home (`isHome`) per the existing repo's `apps/web/src/app/page.tsx`. Treat Home as the real default; don't preserve the mock's preview default.
4. **Auth submit behavior**: the mock always succeeds with no validation or error states. The real implementation needs actual error handling (invalid credentials, duplicate signup email, etc.) wired to the existing `apps/api` auth endpoints — the mock gives no guidance on copy/behavior for these error paths, so the Architect/Coder should follow whatever pattern the existing `login/page.tsx`/`signup/page.tsx` (if already partially implemented) or `auth-api.ts` client already establishes.
5. **Set Detail per-row Owned/Missing badges**: only shown for signed-in users viewing a *public* set (not canonical, not signed-out) — double-check this asymmetry is intentional (it is, per the mock's `showOwned`/`showMissing` logic gated on `isPubDetail && signedIn`) rather than a mock oversight, since it's an easy detail to drop.
6. **"Plate not yet photographed" placeholder**: the Coin Detail image slot is explicitly a placeholder in the mock (no real coin photography exists). Confirm whether real photography/imagery is in scope for this task at all — if not, keep the placeholder circle-avatar treatment as the permanent design, not a temporary stand-in.
7. **Key-date star visibility toggle** (`showKeyDateStars`): the mock exposes this as a design-preview prop, defaulting on. Unless the PRD calls for a user-facing setting, treat key-date stars as always-on and not configurable.
