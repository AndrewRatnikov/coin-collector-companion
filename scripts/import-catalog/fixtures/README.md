# Import-catalog fixtures

Real-data fixtures for the v2 catalog import script (`docs/backlog_week1.md` task 4.1, not yet
built). These are intentionally in a raw, pre-sanitization shape — `mintMark`/`variety` use
`null` where the source has no value, not the `''` the DB requires (`system-design_v2.md` §4.1) —
so the import script has real messy input to normalize against, per task 1.1's intent.

## `us-cents-lincoln-wheat.json`

142 coins, Lincoln Wheat Cent, 1909–1958 (`country: "USA"`, `denomination: "Cent"`). Provenance
is documented inline in the file's own `sources` field. In short: the year/mint-mark/variety
identity list was originally authored for the v1 build (`CLAUDE.md` backlog item 3.2, cross-checked
against Wikipedia and standard Red Book mint-mark-by-year tables) and recovered here from git
history (`git show 4c7795a~1:seed/templates/lincoln-wheat-cents.json`) rather than re-derived,
since those facts don't change between v1 and v2 — only the schema shape does.

**Not yet included: images.** No `imageUrl`/`imageSource`/`imageLicense` data — Wikimedia Commons
images need per-image license vetting via the `extmetadata` gate described in
[docs/catalog-data-licensing.md](../../../docs/catalog-data-licensing.md) §2, which is separate
work from the identity data pulled here.

**Resolved:** backlog task 0.2 (license/ToS check) is done — see
[docs/catalog-data-licensing.md](../../../docs/catalog-data-licensing.md) for the full check
against Wikipedia's, Commons', and the US Mint's actual policies. This fixture's identity data is
cleared: Lincoln Wheat Cents (1909–1958) are pre-1989, so the coin designs are public domain by
rule, and the year/mint-mark/variety facts pulled from Wikipedia aren't independently copyrightable
regardless. Images still need the per-file `extmetadata` check before being added to this fixture.
