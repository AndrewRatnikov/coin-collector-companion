# Page splits move JSX into prop-only section components while the route file keeps all state, effects, data hooks and handlers

- **Status:** Accepted
- **Date:** 2026-11-10
- **Source:** orchestrator run `run_20261110_073521` (Phase 2 of 4 of the page-split refactor: the set page; the constraint came from the PRD, acceptance criterion 2)
- **Code:** `apps/web/src/app/sets/[id]/page.tsx`, `apps/web/src/components/set-page/set-page-header.tsx`, `apps/web/src/components/set-page/set-page-toolbar.tsx`, `apps/web/src/components/set-page/set-page-year-groups.tsx`, `apps/web/src/components/set-page/set-page-shared.ts`

## Context

`apps/web/src/app/sets/[id]/page.tsx` was 825 lines: about 278 lines of state, effects, data hooks and handlers (`SetEditor`), plus the JSX for every section. It is the first of a series of page splits (phases 3 and 4 do `add-coins-sheet.tsx` and `sets/new/page.tsx`). The series is meant to change no behaviour, no rendered DOM and no copy, and the PRD ruled out new contexts and moving state or effects out of the page. The decision was where the state lives once the JSX is split out, since later phases will copy the pattern.

## Decision

Each section of the set page is a presentational component in `apps/web/src/components/set-page/`: `SetPageLoading` and `SetPageError` (`set-page-load-states.tsx`), `SetPageHeader`, `SetPageToolbar`, `SetPageEmpty`, `SetPageUpgradeEmpty` and `SetPageCompleteEmpty` (`set-page-empty-states.tsx`), `SetPageYearGroups`, `SetPageSelectHint` and `SetPageLiveRegion` (`set-page-status.tsx`), and `SetPageDeleteDialog`. Shared constants and the `SetFilter` type are in `set-page-shared.ts`.

- The components take values and callbacks as props (`onFilterChange`, `onMarkYear`, `onShowAll`, `onRetry`, and so on). The only hook they call is `useTranslation()`, each for its own `t` and `locale`. They call no `useState`, `useRef`, `useEffect`, `useMemo`, `useCallback`, context or `@/lib/hooks/*` hook; a grep of the directory on the branch finds none.
- `SetEditor` in `page.tsx` keeps every `useState`, `useRef`, `useEffect`, data hook, mutation and named handler, and composes the components. The render-time name sync, the derived values and the `body` branch chain also stay there.
- The route-level composition uses slots instead of context: `SetPageHeader` takes `children` (the toolbar cells), and `SetPageToolbar` returns a fragment so its two cells remain direct children of the header grid and takes the actions menu as an `actionsMenu` node.
- The JSX is moved, not rewritten. Only identifiers that became props are renamed. The rename input ref is passed through as a prop.
- Every component file starts with `'use client'`, uses named exports and exports a `...Props` interface.

Small deviations recorded in `deviations.md` do not change the pattern: the two empty states keep `onClick={() => onShowAll()}`, and a JSX comment moved into a JSDoc.

## Alternatives considered

- **A `SetPageContext` provider read by each section.** Lost: the PRD forbids new contexts, and it hides which section uses which value.
- **Custom hooks (for example `useSetSelection`) that take state and effects out of `page.tsx`.** Lost: AC2 forbids it, and it risks behaviour drift in a refactor that promises none.
- **Passing `t` and `locale` down as props.** Lost: it lengthens every props list, and the existing `components/sets/*` components already call `useTranslation()` themselves.

## Consequences

- State lives in one file, so there is one place to read for behaviour, and each section can be read in isolation. The existing page tests (which render the page's default export) cover the moved JSX unchanged.
- **`page.tsx` is 521 lines, not the ~300 the series aimed for.** The 278 lines of state and handlers, the 46 lines of derived values and the composition JSX with its long props lists (header, toolbar, `SetActionsMenu`) stay by design. Reaching 300 would need handler or state extraction, which this decision excludes. It is a reported open item. Any later reduction means a separate decision on extracting handlers into hooks, which would supersede the "route file keeps all state" half of this one.
- Props lists are long, and callers must pass each callback explicitly. That is the cost of avoiding context.
- Phases 3 and 4 follow this pattern: `components/<page>/` with prop-only sections, and the route or parent file owning the state.
