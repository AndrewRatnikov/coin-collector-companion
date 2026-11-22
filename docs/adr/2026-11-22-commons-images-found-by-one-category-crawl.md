# Ukrainian coin images are found by crawling Category:Coins of Ukraine once and matching file names locally

- **Status:** Accepted
- **Date:** 2026-11-22
- **Source:** orchestrator run `run_20261122_084533` (images for the Ukrainian part of the catalog, `docs/catalog-expansion-research.md` Licensing item 2)
- **Code:** `scripts/import-catalog/lib/commons.ts`, `scripts/import-catalog/lib/find-images.ts`, `scripts/import-catalog/find-images.ts`

## Context

The task asked for a command that, for each Ukrainian fixture coin, finds a Wikimedia Commons image in `Category:Coins of Ukraine` and its subcategories, matched on denomination, year and subject. Commons asks automated clients to be polite: the task required a descriptive User-Agent, a few files per request and sequential requests. The tests must run on recorded API responses, never the network, so the lookup has to be deterministic.

## Decision

`lib/commons.ts` lists the whole category tree once and matches the coins against that list locally.

- `listCategoryFiles` walks `Category:Coins of Ukraine` breadth-first to `MAX_CATEGORY_DEPTH` (4), using `list=categorymembers` with `cmlimit=500` and following `continue` until it is absent. One request is awaited at a time.
- Only the files that match at least one coin are then read with `prop=imageinfo` plus `extmetadata`, at most `IMAGEINFO_BATCH_SIZE` (5) titles per request, also sequential.
- Every request carries the generator's User-Agent from `buildUserAgent` (optional `WIKIPEDIA_CONTACT`).
- Fetch, file reads and writes are injected, as in the fixture generator, so specs pass recorded responses.

## Alternatives considered

- **One CirrusSearch request per coin** (`list=search` with `deepcat:`). Rejected: it needs 218 or more requests, `deepcat` silently truncates large category trees, and search ranking is not deterministic, so recorded-response tests would prove little.

## Consequences

- The request count depends on the size of the category tree, not on the number of coins.
- The match rules are plain functions of file titles and categories, so the specs pin them exactly (see [2026-11-22-commons-image-match-is-strict-and-lists-the-rest](2026-11-22-commons-image-match-is-strict-and-lists-the-rest.md)).
- Files deeper than 4 category levels, or outside `Category:Coins of Ukraine`, are never seen. A coin whose only photo lives elsewhere ends up as "none" and needs a hand-added image.
- Matching is on file names and category names only, so coins whose Commons files are named in Ukrainian or generically are missed unless the fixture has `titleUk`.
