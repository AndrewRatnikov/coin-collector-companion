# Wikipedia wikitext excerpts

Small excerpts of real English Wikipedia articles, used by the fixture generator specs (`import-catalog-*.spec.ts`). The specs never touch the network. The lines are copied unchanged from the article wikitext; truncated tables are closed with `|}`.

Fetched 2026-11-21 with `https://en.wikipedia.org/w/api.php?action=parse&page=<title>&prop=wikitext|revid&format=json&formatversion=2&redirects=1`.

| File | Article | pageid | revid |
|---|---|---|---|
| `united-states-cent-mintage-figures.wikitext` | United States cent mintage figures | 1835871 | 1322056496 |
| `washington-quarter-mintage-figures.wikitext` | Washington quarter mintage figures | 29743901 | 1330533271 |

## What each excerpt keeps

- Cent: the Flowing Hair and Liberty Cap tables (rowspan years, design named in a Comments cell, `c9` and `^` mintage cells), then the Indian Head cupronickel tables and the bronze table through 1865 (Proof rows).
- Quarter: the silver table through 1936, the clad table (1965: `^` rows and a footnoted figure), the Bicentennial table (proof and pattern rows), the 1977 rows of the Eagle table, and the District of Columbia and Puerto Rico tables (design named in the caption).

Wikipedia text is CC BY-SA 4.0. The excerpts are test data only.
