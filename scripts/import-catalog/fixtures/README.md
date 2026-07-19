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
images need per-image license vetting (public-domain or attribution-free only, per
`system-design_v2.md` §4.3), which is separate research from the identity data pulled here.

**Still open:** backlog task 0.2 (license/ToS check for Wikipedia mintage data and Commons images)
is a day-one gate per `docs/backlog_week1.md` — confirm that before this fixture is treated as
cleared for the real import script, even though the identity facts here (which year/mint-mark
combinations exist) are historical facts and not copyrightable expression on their own.
