# The Add coins sheet's Escape and Tab keydown effect lives in a hook the sheet calls, as a narrow exception to prop-only components

- **Status:** Accepted
- **Date:** 2026-11-10
- **Source:** orchestrator run `run_20261110_214902` (Phase 3 of 4 of the file-size refactor: `add-coins-sheet.tsx`; the PRD required a focus-trap hook module)
- **Code:** `apps/web/src/components/sets/add-coins/use-add-coins-focus-trap.ts`, `apps/web/src/components/sets/add-coins-sheet.tsx`, `apps/web/src/components/sets/add-coins/year-popover.tsx`

## Context

[2026-11-10-set-page-sections-are-prop-only-components](2026-11-10-set-page-sections-are-prop-only-components.md) set the pattern for these splits: extracted components are prop-only, the state owner keeps all state and effects, and custom hooks that take effects out of the state owner were rejected. Phase 3 split `add-coins-sheet.tsx` (735 lines) into `components/sets/add-coins/`. The PRD named "a focus-trap hook" as one of the pieces. The sheet has one document-level `keydown` effect that handles Escape (unless a popover already called `preventDefault`) and traps Tab inside the panel. Leaving it inline would not meet the PRD, and the refactor promises no behaviour change.

## Decision

The whole existing keydown effect moves unchanged into `useAddCoinsFocusTrap(panelRef, onCloseRef)` in `use-add-coins-focus-trap.ts`, with its `[]` dependency list.

- `AddCoinsSheet` calls the hook at the position the effect had (`useAddCoinsFocusTrap(panelRef, onCloseRef)`), so the effect is registered in the same order with the same deps.
- The sheet still creates and owns `panelRef` and `onCloseRef` and passes them in. The hook reads them at event time and holds no state.
- The hook contains Escape and Tab together, plus the `FOCUSABLE` selector and `isVisible` helper that only it uses.
- The exception is limited to this case: an existing effect may be wrapped in a hook when the body is unchanged, the call stays at the old position, and the caller owns the refs. The set-page ADR stays Accepted for everything else.

`YearPopover` (`year-popover.tsx`) keeps its own `useState` for the typed text and its own cleanup `useEffect` for the debounce timer. That state was already local to the popover and is moved, not lifted, so the sheet's state and effects are otherwise unchanged. This is a second, smaller departure from "components call no state hooks" and falls under the same rule: moved code keeps its state where it was.

## Alternatives considered

- **A hook for only the Tab part, with Escape left in the sheet.** Lost: it adds a second `keydown` listener and changes handler order.
- **Leave the effect inline and move only `FOCUSABLE` and `isVisible`.** Lost: it fails the PRD's requirement for a focus-trap hook.
- **Supersede the set-page ADR.** Not done: its rule still holds for state and data hooks, and this is one required, behaviour-neutral case.

## Consequences

- Behaviour cannot drift: same listener, same order, same deps. The existing sheet tests (unchanged, with no import path changes) cover Escape and Tab.
- `AddCoinsSheet` ended at 303 lines, not the roughly 309 the plan expected, and above the ~300 target only by a few lines; going lower would need moving handlers or derived values, which the pattern excludes.
- The hook's `[]` deps without listing the refs is deliberate and relies on the caller passing stable refs. A caller that passes changing refs would need the deps revisited.
- Phase 4 (`sets/new/page.tsx`) may meet the same question. Use this rule: wrap an effect in a hook only when the PRD calls for it, the body is unchanged, the call position is the same and the caller owns the refs.
