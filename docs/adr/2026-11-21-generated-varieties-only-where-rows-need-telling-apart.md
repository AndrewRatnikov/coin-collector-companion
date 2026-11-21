# Generated fixtures give a row a variety only where it is needed to tell rows apart, and leftover duplicate keys are flagged, never merged

- **Status:** Accepted
- **Date:** 2026-11-21
- **Source:** orchestrator run `run_20261121_180454` (fixture generator; task: "a table caption or row note that names a design becomes the variety", "never invent or fill in a mintage")
- **Code:** `scripts/import-catalog/lib/mintage-tables.ts`, `scripts/import-catalog/lib/generate.ts`
- **Supersedes:** `docs/catalog-data-licensing.md` §1 (only the literal User-Agent example: the contact is now the repo URL, and an email is appended only from `WIKIPEDIA_CONTACT`)

## Context

The task asked that a caption or row note naming a design become the variety. In the real articles that would be wrong if applied blindly: every Eagle-reverse quarter would get variety "Eagle", and the 1934 note "Doubled die errors are known." would become a variety. Proofs are marked as rows in the Comments cell, not in a "Proof" column. Under [2026-11-21-catalog-import-diffs-per-file-and-writes-one-transaction](2026-11-21-catalog-import-diffs-per-file-and-writes-one-transaction.md) the importer keeps only the last of several rows with the same natural key `(country, denomination, year, mintMark, variety)`, so a duplicate silently loses a coin.

## Decision

`extractMintageRows` in `lib/mintage-tables.ts` keeps only business strikes and decides variety in this order:

1. A row is skipped when its note says proof, pattern, restrike or bullion, or when its table's caption or Mintage header says proof. Only the Year, Mint, Mintage and Comments columns are ever read. Every skipped row is listed in the summary with its reason.
2. The caption design (the caption minus years, parentheses and a trailing "reverse") becomes the variety only in years where rows come from tables with different designs.
3. A `^` mintage ("included above") with no note that shares its key with another row is dropped as `included-above`. A group made only of such rows is kept, so no key is lost.
4. A row note becomes the variety (`"{caption} ({note})"` when there is also a caption variety) only when it is needed to split rows sharing (year, mint mark, caption variety). These rows are marked `varietySource: 'note'` and listed in the summary under "Varieties from row notes (check these)".
5. Keys still shared are emitted as they are and listed under "Duplicate natural keys (set a variety by hand before importing)".

Mintage is only a figure the source gives: `^`, `c9`, `c3-4`, `unknown`, an empty cell or a footnote alone give `null`. No mintage is estimated or set to 0. Mint marks `(P)` (struck there, no mark) give `mintMark: null`, and no mark and no variety are written as `null`, like the existing fixtures. Specs, the key-date flag and images are not written.

The default User-Agent is `coin-collector-companion/0.1 (https://github.com/AndrewRatnikov/coin-collector-companion)`, which meets Wikimedia's "contact URL or email" rule. `WIKIPEDIA_CONTACT`, when set, is appended after `; `. No email is hard-coded.

## Alternatives considered

- Always using the caption as the variety, or always using the note. Both put noise in the catalog (see Context).
- Dropping or merging duplicate keys. It silently loses a coin or a mintage.
- Hard-coding the email from the licensing doc in the User-Agent. It would publish a personal address in source and in every request.

## Consequences

- Fixtures look like the hand-written ones: `null` for the main type, a variety only where the source forces one.
- A note variety can still be noise (the 1977 `(W) ^` row gets "First time West Point produced the quarter"); the summary lists it so a person can change it.
- The maintainer must resolve any listed duplicate key before importing. For example, the two 1864 rows without a variety in the cent excerpt.
- The keyword rule can miss a non-business strike whose note doesn't use those words, or skip a business row that mentions them. The skipped list in the summary is the check.
- `docs/catalog-data-licensing.md` §1 still shows the literal User-Agent example with an email; the format is unchanged.
