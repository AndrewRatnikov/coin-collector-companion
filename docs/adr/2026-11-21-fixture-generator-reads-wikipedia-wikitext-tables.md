# The fixture generator parses the article's wikitext with a built-in table reader, not rendered HTML with a parser library

- **Status:** Accepted
- **Date:** 2026-11-21
- **Source:** orchestrator run `run_20261121_180454` (fixture generator for `scripts/import-catalog`, `docs/catalog-expansion-research.md` "Before adding coins" item 1; the PRD left wikitext vs HTML and a parsing dependency open)
- **Code:** `scripts/import-catalog/lib/wikitext.ts`, `scripts/import-catalog/lib/generate.ts`, `scripts/import-catalog/generate-fixture.ts`

## Context

The generator turns an English Wikipedia mintage article into a raw fixture. The MediaWiki `action=parse` API can return the article as wikitext (`prop=wikitext`) or as rendered HTML (`prop=text`). The target articles ("United States cent mintage figures", "Washington quarter mintage figures", and the Lincoln, nickel, dime and America the Beautiful ones) all use one regular table layout: a caption, then Year, Mint, Mintage and Comments columns, with `rowspan` on the year. Each fixture also has to be traceable to the exact text it was built from.

## Decision

`fetchArticle` requests `prop=wikitext|revid` (`format=json`, `formatversion=2`, `redirects=1`) in one sequential request. `runGenerate` writes the response body verbatim to `sources/<article>.<date>.json` before parsing, so the parsed input and the saved input are the same text. `parseWikitextTables` in `lib/wikitext.ts` is a small reader with no coin knowledge: it handles `{|`/`|}`, captions, `!` and `|` cells, `||` and `!!` separators at nesting depth 0, cell attributes, and `rowspan`/`colspan` expansion. `cleanWikitext` strips refs, templates, links and markup. No dependency was added, so the lockfile is unchanged.

## Alternatives considered

- Rendered HTML (`prop=text`) with a parser library such as cheerio or node-html-parser. It would add a dependency (the pnpm `minimumReleaseAge` rule, the lockfile security-floor test, more install surface) for tables whose wikitext is already regular. HTML footnotes (`<sup class="reference">`) need the same stripping anyway.
- Regexes over HTML. They can't handle `rowspan`.

## Consequences

- The tool stays dependency-free and the saved source is the parsed source.
- The reader understands only what the target articles use. Other wikitext table shapes are not supported. In particular, the wide layout of "50 State quarter mintage figures" and "American Women quarters" (one column per mint) is not parsed: such tables are listed under "Tables ignored" in the summary, and a run with zero rows exits 1 without writing `--out`. A second reader can be added without changing the fixture format.
- Wikipedia edits can change table structure; the saved response and the `revisionId` in the fixture's `sources` block pin what each fixture came from.
- Revisit if a target article needs templates or nested structures the reader can't handle.
