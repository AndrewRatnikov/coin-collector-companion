# Empty catalog searches are sent to PostHog as `catalog_no_results`, with the filters and a 40-character search text

- **Status:** Accepted
- **Date:** 2026-11-23
- **Source:** orchestrator run `run_20261123_220432` (analytics event for coins people look for and don't find; the owner's request from `docs/catalog-expansion-research.md` "Let demand decide the order")
- **Code:** `apps/web/src/lib/analytics.ts`, `apps/web/src/lib/catalog-view.ts`, `apps/web/src/app/catalog/page.tsx`, `apps/web/src/lib/i18n/locales/en/privacy.ts`, `apps/web/src/lib/i18n/locales/es/privacy.ts`

## Context

The catalog is being expanded country by country, and the owner wants demand to set the order: which coins visitors search for and don't find. [2026-11-20-posthog-cookieless-analytics](2026-11-20-posthog-cookieless-analytics.md) fixed a closed list of five events with small enumerated properties. None carried free text, and the /privacy copy said PostHog never receives searches. A "which coin" signal needs the search text.

## Decision

- A sixth event, `catalog_no_results`, joins the closed `AnalyticsEvents` union with five properties, each `string | null`: `country`, `denomination`, `year_from`, `year_to`, `name`.
- `name` is the search text trimmed, lowercased and cut to `CATALOG_NO_RESULTS_NAME_MAX_LENGTH` (40) characters, in that order; `null` when empty after trimming. `catalogNoResultsProps(view)` in `catalog-view.ts` builds the properties as a pure function.
- Several selected denominations are sent as one string, copied, sorted in default code-unit order and joined with `,` (`1 Cent,50 Cents`), so the same selection is one value whatever the click order.
- Sort, page, Hide owned and Key dates only are never sent.
- The event goes only through `track()`. The cookieless, never-identify rules of the 2026-11-20 ADR are unchanged. Like the other events it is off without `NEXT_PUBLIC_POSTHOG_TOKEN`.
- The `privacy.analyticsBody` text in EN and ES drops "searches" from the list of things PostHog never receives, names catalog searches that find nothing, and says only the filters and the search text, shortened to 40 characters, are sent.

## Alternatives considered

- **Filters only, no search text:** loses the most direct signal of which coin was wanted.
- **Logging empty searches server-side in the database:** needs API and schema changes; out of scope.
- **One event per selected denomination:** multiplies counts per search.
- **An array property for denominations:** breaks the agreed `string | null` shape.
- **Face-value order from [2026-11-21-denominations-ordered-by-face-value-parsed-from-the-string](2026-11-21-denominations-ordered-by-face-value-parsed-from-the-string.md):** needs a parser for what is only a grouping key.

## Consequences

- PostHog now receives free text typed by visitors. Truncation and lowercasing limit it, and with `person_profiles: 'never'` nothing ties it to a person, but someone can still type personal data into the search box. The public privacy copy says so.
- The 2026-11-20 ADR's "closed list of five events" is now six. That ADR is not edited; its rules all still hold.
- Hide owned and Key dates only are not sent, so a signed-in user who owns every match reports a search as empty when the coins exist. If that noise matters, skip the event when either flag is on.
- Counts are per day-hashed visitor (cookieless), so the same person on two days counts twice. This is fine for ranking demand.
- Revisit if the search text proves too identifying or too noisy, or if demand should be logged server-side.
