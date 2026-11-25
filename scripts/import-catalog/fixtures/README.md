# Import-catalog fixtures

Real-data fixtures for the v2 catalog import script (`../import-coins.ts`, `docs/backlog_week1.md`
task 4.1). These are intentionally in a raw, pre-sanitization shape — `mintMark`/`variety` use
`null` where the source has no value, not the `''` the DB requires (`system-design_v2.md` §4.1) —
so the import script has real messy input to normalize against, per task 1.1's intent.

## `us-cents-lincoln-wheat.json`

142 coins, Lincoln Wheat Cent, 1909–1958 (`country: "USA"`, `denomination: "Cent"`). Provenance
is documented inline in the file's own `sources` field. In short: the year/mint-mark/variety
identity list was originally authored for the v1 build (`CLAUDE.md` backlog item 3.2, cross-checked
against Wikipedia and standard Red Book mint-mark-by-year tables) and recovered here from git
history (`git show 4c7795a~1:seed/templates/lincoln-wheat-cents.json`) rather than re-derived,
since those facts don't change between v1 and v2 — only the schema shape does.

**Specs and mintage:** file-level `specs` (19.05 mm, 3.11 g, bronze) with per-coin overrides for
the 1943 steel cents and the 1944–1946 brass cents. Mintages are per year/mint from Wikipedia's
"Lincoln cent mintage figures"; the 1922 No D and 1955 Doubled Die error varieties are `null`, since
they were struck inside their parent issue's mintage and have no separate figure. Thickness is
only set where a source gives it (1943 steel). Provenance is in the file's `sources` field.

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

## `us-cents-lincoln-memorial-bronze.json` / `us-cents-lincoln-memorial-zinc.json` / `us-cents-lincoln-bicentennial.json` / `us-cents-lincoln-shield.json`

146 Lincoln cent business strikes, 1959–2025 (`country: "USA"`, `denomination: "Cent"`), in four
files: `us-cents-lincoln-memorial-bronze.json` (Lincoln Memorial Cent, 1959–1982, 52 coins),
`us-cents-lincoln-memorial-zinc.json` (Lincoln Memorial Cent, 1982–2008, 54 coins),
`us-cents-lincoln-bicentennial.json` (Lincoln Bicentennial Cent, 2009, 8 coins) and
`us-cents-lincoln-shield.json` (Lincoln Shield Cent, 2010–2025, 32 coins).

**Provenance.** Generated with `pnpm run generate` (`../generate-fixture.ts`) from English
Wikipedia's "Lincoln cent mintage figures", revision 1365409408, fetched 2026-11-21. The raw API
response is saved unmodified as `../sources/Lincoln_cent_mintage_figures.2026-11-21.json` and cited
in each file's `sources[0]`. "United States cent mintage figures" was not used: its Lincoln section
only links to "Lincoln cent mintage figures" and has no tables, so the generator finds no rows in it.
The generator's draft (176 rows) was curated by hand into these four files and was not committed:
the import reads every `*.json` in this directory.

**Selection rules** (also in each file's `rules-note`):
- Business strikes only. Proofs and patterns are skipped by the generator; collector-only strikes are
  dropped by their comment: the 1965–1967 Special Mint Set coins, the eight 2009 Satin uncirculated
  coins, 2017 S "Enhanced uncirculated" and 2019 W "Uncirculated".
- 1968 S (258,270,001) is restored by hand. It is a business strike, but its comment ("Lowest minted
  non-proof memorial coin") matched the generator's proof rule.
- Mint marks are as on the coin. A Mint cell in parentheses (`(P)`, `(D)`, `(S)`, `(W)`) means the coin
  has no mark. Unmarked coins from branch mints can't be told apart from Philadelphia ones, so each
  year with such rows is one no-mark coin whose mintage is the sum of the source figures, listed per
  year in the bronze file's `mintageSums` (which the import ignores): 1964, 1965, 1966, 1967, 1974,
  1975, 1976, 1977, 1978, 1979 and 1980. 1981 and 1983–1986 are not summed: their `(W)` figure is `^`
  (included above). The generator's note-varieties on these rows ("... struck in 1965", "First time
  West Point produced the cent") are dropped.
- 1982 has the varieties `Copper` (bronze file) and `Zinc` (zinc file) for no mark and D.
- 2009 has the four designs as varieties, `Birthplace`, `Formative Years`, `Professional Life` and
  `Presidency`, for no mark and D, each with its design table's business-strike figure.
- 2017 carries a `P` mint mark, the only year it does.
- No other varieties: comments like "Doubled-Die varieties have been found" or "Small and Large date
  varieties" have no separate row or figure.

**Specs.** Diameter, weight and composition from the "Lincoln cent" infobox, with the compositions
cross-checked against the saved source's table captions: 19.05 mm everywhere; bronze 3.11 g, "Bronze
(95% copper, 5% zinc)" as the bronze file default, with a per-coin override to "Bronze (95% copper,
5% tin and zinc)" for 1959–1961; copper-plated zinc 2.5 g, "Copper-plated zinc (97.5% zinc, 2.5%
copper)" for the zinc, Bicentennial and Shield files. The Memorial cent is split into two files by
composition so each file's defaults fit its coins. Thickness is not set, as in the Wheat fixture.

**Null mintages.** Only the four 1982 rows. The source gives one combined figure per mint for both
compositions (10,712,525,000 without a mark, West Point included; 6,012,979,368 D), with `^` on the
copper-plated zinc rows, so neither variety gets a figure of its own.

**Excluded.** Proofs (including reverse proofs), Special Mint Set and other set-only strikes,
patterns, and 2026, whose cents are collector-only. `isKeyDate` is false throughout, since no source
flags key dates. There are no images: US designs from 1989 on need the per-design check in
[docs/catalog-data-licensing.md](../../../docs/catalog-data-licensing.md) before any are added.

**Not in production yet.** Running the import and `seed:canonical` against production is the
pending manual pass under growth backlog 2.9.

## `us-nickels-jefferson-*.json` (two files: copper-nickel and wartime silver)

194 Jefferson nickel business strikes, 1938–2025 (`country: "USA"`, `denomination: "Nickel"`,
name "Jefferson Nickel"), in two files split by composition:
`us-nickels-jefferson-copper-nickel.json` (1938–2025, 183 coins) and
`us-nickels-jefferson-wartime-silver.json` (1942–1945, 11 coins).

**Provenance.** Generated with `pnpm run generate` from English Wikipedia's
"United States nickel mintage figures", revision 1322056545, fetched 2026-11-25. The raw API
response is saved unmodified as `../sources/United_States_nickel_mintage_figures.2026-11-25.json` and cited in each
file's `sources[0]`. The generator's draft (194 rows) was curated by hand into these two files and
was not committed.

**Selection rules** (also in each file's `rules-note`):
- Business strikes only. Proofs (including the S and W proof and reverse-proof rows) are skipped by
  the generator; the set-only strikes 1994 P (167,703) and 1997 P (25,000) "Special Frosted Matte
  Uncirculated" and 2017 S (223,310) "Enhanced Uncirculated" are dropped by hand, as is the 1938 D
  Indian Head (Buffalo) nickel row.
- 1950 D (2,630,030) is restored by hand: a business strike whose comment ("lowest non-proof")
  matched the generator's proof rule.
- Mint marks are as on the coin, as in the Lincoln cent files and under
  `docs/adr/2026-11-21-unmarked-branch-mint-strikes-summed-into-one-coin.md`: a Mint cell in
  parentheses (`(P)`, `(P/D/S)`) means no mark (`null`), a plain letter is the mark. 1965, 1966 and
  1967 are one no-mark coin each, restored by hand (the generator skipped the `(P/D/S)` cell); each
  uses the source's own single figure, so nothing is summed and there is no `mintageSums`.
- The 1942–1945 wartime silver alloy coins are their own file, so each file's default specs fit its
  coins. 1942 has both compositions: the no-mark and D coins are copper-nickel, the P and S coins
  wartime silver. The wartime coins carry the large mint mark above Monticello, including a real P.
- The 2004–2005 Westward Journey designs are varieties, P and D each: 2004 `Louisiana Purchase` and
  `Keelboat`, 2005 `American Bison` and `Ocean in View`. The caption varieties the generator set
  where two tables meet (1938, 1942) are dropped; there are no other varieties.
- Mintages only as the source gives them; nothing is estimated.

**Specs.** From the "Jefferson nickel" infobox (revision 1383232384): 21.21 mm, 5 g;
"Copper-nickel (75% copper, 25% nickel)" and, for the wartime file, "Silver alloy (56% copper, 35%
silver, 9% manganese)". No thickness: no cited source gives it.

**Null mintages.** None.

**Key dates.** `isKeyDate` is true for 1939-D and 1950-D only, because the saved source's prose
names them: "Key dates for the series include the 1939-D, and 1950-D nickels." The copper-nickel
file records this in a `keyDates` block (saved source path, verbatim quote, coin labels), and the
"Jefferson Nickel Key Dates" checklist lists the two coins.

**Excluded.** Proofs, Special Mint Set and other set-only strikes, and 2026: the source's tables end
at 2025, so there is no 2026 coin yet, although the checklist is named "Jefferson Nickels 1938-2026".
No images.

**Not in production yet.** Running the import and `seed:canonical` against production is the
pending manual pass under growth backlog 2.9.

## `us-dimes-roosevelt-*.json` (two files: silver and clad)

168 Roosevelt dime business strikes, 1946–2025 (`country: "USA"`, `denomination: "Dime"`, name
"Roosevelt Dime"), in two files split by composition: `us-dimes-roosevelt-silver.json` (1946–1964,
48 coins) and `us-dimes-roosevelt-clad.json` (1965–2025, 120 coins).

**Provenance.** Generated with `pnpm run generate` from English Wikipedia's
"Roosevelt dime mintage figures", revision 1333683926, fetched 2026-11-25. The raw API response is saved unmodified as
`../sources/Roosevelt_dime_mintage_figures.2026-11-25.json` and cited in each file's `sources[0]`.
The draft was curated by hand into these two files and was not committed.

**Selection rules** (also in each file's `rules-note`):
- Business strikes only. Proofs are skipped by the generator; the set-only 1996 W dime and the
  2005–2010 "Satin" and 2017 S "Enhanced" rows are left out.
- Mint marks follow the Mint cell, as in the Lincoln cent files: a cell in parentheses (`(P)`,
  `(P & D)`) means no mark (`null`), a plain letter is the mark. 1965, 1966 and 1967 are one no-mark
  coin each, restored by hand (the generator skipped the `(P & D)` cell), each with the source's one
  combined figure, so nothing is summed and there is no `mintageSums`. 1968–1979 are a no-mark coin
  and D; from 1980 P and D.
- **Plain P on the silver dimes.** The source writes a plain P for every 1946–1964 Philadelphia dime,
  although those coins carry no mint mark (the "Roosevelt dime" infobox: no mint mark at Philadelphia
  before 1980). The fixture keeps the plain P as the source gives it. This is provisional: confirm it
  by hand before the production import under 2.9, while changing the keys is still cheap.
- The 1982 no-mint-mark dime has its own row and is kept as a no-mark coin (see Null mintages).
- No varieties.

**Specs.** From the "Roosevelt dime" infobox (revision 1383234426): 17.91 mm; silver file 2.5 g,
"Silver (90% silver, 10% copper)"; clad file 2.268 g, "Copper-nickel clad copper (75% copper, 25%
nickel outer layers, pure copper core)". No thickness.

**Null mintages.** Only the 1982 no-mark dime: the source prints its figure in parentheses,
"(150,000)", as an estimate, and no figure is estimated here.

**Key dates.** None: no cited source names key dates, so `isKeyDate` is false throughout.

**Excluded.** Proofs, Special Mint Set and set-only strikes such as the 1996-W dime, and 2026: the
source's table ends at 2025, so there is no 2026 coin yet, although the checklist is named
"Roosevelt Dimes 1946-2026". No images.

**Not in production yet.** Running the import and `seed:canonical` against production is the
pending manual pass under growth backlog 2.9.

## `us-quarters-washington-*.json` (two files: silver and clad, 1932-1998)

146 Washington quarter business strikes, 1932–1998 (`country: "USA"`, `denomination: "Quarter"`,
name "Washington Quarter"), in two files split by composition: `us-quarters-washington-silver.json`
(1932–1964, 83 coins) and `us-quarters-washington-clad.json` (1965–1998, 63 coins). The 1999 and
later quarters are in the files of the next section, which this run did not change.

**Provenance.** Generated with `pnpm run generate -- ... --years 1932-1998` from English Wikipedia's
"Washington quarter mintage figures", revision 1330533271. The 2026-11-25 response was byte for byte
the one already saved for the 1999-2026 quarters, so both files cite the existing
`../sources/Washington_quarter_mintage_figures.2026-11-21.json` (`fetchedAt: "2026-11-21"`) instead
of a second copy. The draft was curated by hand into these two files and was not committed.

**Selection rules** (also in each file's `rules-note`):
- Business strikes only. Proofs and the 1976 pattern are skipped by the generator; the Satin finish
  Special Mint Set rows of 1964–1967 and the 1976 S silver-clad uncirculated coins sold in sets are
  dropped.
- Mint marks follow the Mint cell, as in the Lincoln cent files: `(P)` means no mark (`null`), a
  plain letter is the mark. Silver: no-mark, D and S as listed (no quarters in 1933, no 1938 D, no S
  in 1949 or 1955–1964). 1965–1967 are one no-mark coin each with the `(P)` figure; their `(D)` and
  `(S)` rows are `^` (included above) and add nothing, so nothing is summed and there is no
  `mintageSums`. 1968–1979 are a no-mark coin and D (the 1977–1979 `(W)` rows are `^` and dropped);
  the P mark appears from 1980, and 1980–1998 are P and D.
- **Bicentennial.** The dual-dated quarters (dated 1776-1976, struck in 1975 and 1976) are year 1976
  with variety `Bicentennial`, no-mark and D. There are no 1975 quarters.
- No other varieties: comments like "Doubled die errors are known" have no separate row or figure.

**Specs.** 24.26 mm and 1.75 mm from the "50 State quarters" infobox in the saved
`../sources/50_State_quarters.2026-11-21.json` (the values of the 1999-2026 files); silver file
6.25 g, "Silver (90% silver, 10% copper)" (composition from the "Washington quarter" infobox,
revision 1386916113); clad file 5.67 g, "Copper-nickel clad copper (91.67% copper, 8.33% nickel)".

**Null mintages.** None.

**Key dates.** None: no cited source names key dates (not even 1932-D and 1932-S), so `isKeyDate` is
false throughout.

**Excluded.** Proofs, patterns, Special Mint Set and other set-only strikes. No images.

**Not in production yet.** Running the import and `seed:canonical` against production is the
pending manual pass under growth backlog 2.9.

## `us-quarters-*.json` (six files: 50 State through Semiquincentennial)

286 Washington quarter business strikes, 1999–2026 (`country: "USA"`, `denomination: "Quarter"`),
one file per program, each `name` being the program:
`us-quarters-50-state.json` (50 State Quarters, 1999–2008, 100 coins),
`us-quarters-dc-and-territories.json` (DC and US Territories Quarters, 2009, 12 coins),
`us-quarters-america-the-beautiful.json` (America the Beautiful Quarters, 2010–2021, 122 coins),
`us-quarters-crossing-the-delaware.json` (Washington Crossing the Delaware Quarter, 2021, 2 coins),
`us-quarters-american-women.json` (American Women Quarters, 2022–2025, 40 coins) and
`us-quarters-semiquincentennial.json` (Semiquincentennial Quarters, 2026, 10 coins).

**Provenance.** Five English Wikipedia articles, each fetched once on 2026-11-21 through the
MediaWiki API, with the raw responses saved unmodified under `../sources/` and cited in each file's
`sources[0]`:
- "Washington quarter mintage figures", revision 1330533271
  (`../sources/Washington_quarter_mintage_figures.2026-11-21.json`): DC and US Territories, and
  Washington Crossing the Delaware.
- "50 State quarters", revision 1385898672 (`../sources/50_State_quarters.2026-11-21.json`).
- "America the Beautiful quarter mintage figures", revision 1330531176
  (`../sources/America_the_Beautiful_quarter_mintage_figures.2026-11-21.json`).
- "American Women quarters", revision 1386003407 (`../sources/American_Women_quarters.2026-11-21.json`).
- "United States Semiquincentennial coinage", revision 1384530658
  (`../sources/United_States_Semiquincentennial_coinage.2026-11-21.json`).

Five, not one: for 1999–2026 "Washington quarter mintage figures" only has tables for the 2009 DC
and Territories quarters and the 2021 Crossing quarter; its 50 State, America the Beautiful and
American Women sections just link to their own articles, and it has nothing for 2026. The DC,
Crossing and America the Beautiful files were generated with `pnpm run generate`
(`../generate-fixture.ts`) and curated by hand. The 50 State, American Women and Semiquincentennial
articles have one wide table with a column per mint, which the generator doesn't parse (it saves the
source, then exits with "No usable rows"), so those rows were read by hand from the saved wikitext;
their `sources[0].note` says so. The generator's drafts were not committed: the import reads every
`*.json` in this directory.

**Selection rules** (also in each file's `rules-note`):
- P and D business strikes only, plus the West Point (`W`) quarters of the ten 2019–2020 America the
  Beautiful designs. Excluded: all S coins (proofs, silver proofs, and the 2012–2021 "Uncirculated"
  and 2017 "Enhanced uncirculated" bag coins), silver bullion, `(P)` rows, and the 250,000 2026
  "JULY 4th" privy-mark Declaration quarters without a mint mark. Every coin carries its mint mark,
  so `mintMark` is never null.
- America the Beautiful curation of the generator's draft: the first P and first D row of each park,
  plus W for 2019 and 2020; the ten 2017 note-varieties and the second 2020 Salt River Bay P row (an
  unlabelled bullion row, mintage "TBA") are dropped; 2021 gets `Tuskegee Airmen` (the article has
  only one 2021 table, so the generator leaves it null), and "Grand Cany" is corrected to the table
  caption's "Grand Canyon". The 2020 W "V75 privy mark" comment is not a variety: every 2020 W
  quarter carries it.
- `variety` is always set: the state, territory, park, woman or 2026 design, as displayed in the
  source. Link labels are used (`[[Target|Label]]` gives "Label"), `{{sortname|First|Last}}` is
  rendered "First Last" with any "Dr." prefix kept, and non-ASCII letters are written literally
  ("Edith Kanakaʻole", "Zitkala-Ša"). The 2021 Crossing quarter is `Washington Crossing the Delaware`.
  The Semiquincentennial Subject cells are bare links to the full article titles, so their varieties
  are the short design names `Revolutionary War`, `Declaration of Independence` and `Constitution`
  (with `Mayflower Compact` and `Gettysburg Address`).
- Column order differs between articles: American Women and Semiquincentennial list Denver before
  Philadelphia, and American Women rows have 10 or 11 cells, so mintages are read from the end of
  the row. San Francisco, West Point (2026) and Total columns are ignored.
- Coins are in release order: designs in source order, then P, D (then W).

**Specs.** One file-level `specs` block, no overrides, from the "50 State quarters" and "American
Women quarters" infoboxes in the saved responses: 24.26 mm, 5.67 g, "Copper-nickel clad copper
(91.67% copper, 8.33% nickel)". Thickness (1.75 mm) is set, because the infobox gives it.

**Null mintages.** Only the four 2026 Constitution and Gettysburg Address coins (P and D): the source
lists them with empty mintage cells at this revision. Every other mintage is the source figure.

**Excluded.** Besides the rows above: `isKeyDate` is false throughout, since no source flags key
dates, and there are no images. These designs are from after March 1989, so any image needs the
per-design check in [docs/catalog-data-licensing.md](../../../docs/catalog-data-licensing.md) (plus
the per-file `extmetadata` gate) before it is added; the catalog rows themselves are facts and need
no such check.

**Not in production yet.** Running the import and `seed:canonical` against production is the
pending manual pass under growth backlog 2.9.

## us-dollars-*.json (five files: Presidential through Susan B. Anthony)

227 small-size dollar business strikes, 1971–2026 (`country: "USA"`, `denomination: "Dollar"`),
one file per program, each `name` being the program:
`us-dollars-presidential.json` (Presidential Dollars, 2007–2016 and 2020, 40 designs, 80 coins),
`us-dollars-sacagawea-and-native-american.json` (Sacagawea and Native American Dollars, 2000–2026,
54 coins),
`us-dollars-american-innovation.json` (American Innovation Dollars, 2018–2026, 33 designs, 66 coins),
`us-dollars-eisenhower.json` (Eisenhower Dollars, 1971–1978, 16 coins) and
`us-dollars-susan-b-anthony.json` (Susan B. Anthony Dollars, 1979–1981 and 1999, 11 coins).

**Provenance.** Five English Wikipedia articles, each fetched once on 2026-11-24 with
`pnpm run generate` (`../generate-fixture.ts`), with the raw responses saved unmodified under
`../sources/` and cited in each file's `sources[0]`:
- "Presidential dollar coins", revision 1386046416
  (`../sources/Presidential_dollar_coins.2026-11-24.json`; "Presidential dollar coin" and
  "Presidential $1 Coin Program" redirect to it).
- "Sacagawea dollar", revision 1385999246 (`../sources/Sacagawea_dollar.2026-11-24.json`): both the
  Sacagawea and the Native American coins, since "Native American dollar" redirects to it.
- "American Innovation dollars", revision 1384552479
  (`../sources/American_Innovation_dollars.2026-11-24.json`).
- "Eisenhower dollar", revision 1384170327 (`../sources/Eisenhower_dollar.2026-11-24.json`).
- "Susan B. Anthony dollar", revision 1385912112 (`../sources/Susan_B._Anthony_dollar.2026-11-24.json`).

None of the five layouts is a Year/Mint/Mintage table the generator parses: it saved each source,
then exited with "No usable rows", so every file was read by hand (a scratch script over the saved
wikitext) and its `sources[0].note` says so. The layouts:
- Presidential: one wide "Coin details" table with a column per mint and no Year column; `year` is
  the year of the Release date cell, and Denver Mintage comes before Philadelphia Mintage.
- Sacagawea and Native American: the "Mintage figures" table (Year, Philadelphia, Denver, San
  Francisco, Total; rows 2000–2022) for the mintages, and the "Designs by year" table, whose Theme
  column gives the 2009–2026 reverse design.
- American Innovation: one wide "Coin designs" table (Year as a rowspan, Jurisdiction, ..., then
  Philadelphia, Denver, San Francisco Proof, San Francisco Reverse proof). Rows have 10 or 12 cells,
  so mintages are read from the end of the row.
- Eisenhower: no table; "Mintage figures" is three bulleted lists, and only "Circulation strikes:"
  is used.
- Susan B. Anthony: no mintage table at all; the coins come from the article prose and infobox.

No generator draft was written or committed: the import reads every `*.json` in this directory.

**Selection rules** (also in each file's `rules-note`):
- Business strikes only, including the P and D coins the Mint sold only in rolls, bags and boxes
  (Presidential 2012–2016 and 2020, Native American 2012 onward, all American Innovation). Every
  coin carries its mint mark, so `mintMark` is never null. The Philadelphia Eisenhower dollars carry
  no mint mark on the coin but are `"P"` here (unlike the unmarked Lincoln cents above). S appears
  only in the Anthony file: the 1979, 1980 and 1981 S business strikes. The Morgan and Peace files
  (`us-dollars-morgan.json`, `us-dollars-peace.json`, next section) use `null` for their unmarked
  Philadelphia coins instead, and their two 1921 Philadelphia coins are told apart by the varieties
  `Morgan` and `Peace`.
- `variety` is the design as displayed in the source (`[[Target|Label]]` gives "Label"): the
  president for Presidential, with the two Grover Cleveland rows as "Grover Cleveland (1st term)" and
  "Grover Cleveland (2nd term)"; the year's Native American reverse theme from 2009 (null for the
  Sacagawea reverse, 2000–2008); the jurisdiction for American Innovation ("Introductory" for 2018,
  and the 2020 South Carolina coin released in January 2021 stays 2020, its Year cell); "Type I" and
  "Type II" for the 1776–1976 Eisenhower dollars, which have separate rows with their own figures.
  Every other Eisenhower coin and every Anthony coin has variety null.
- A variety is listed only where the source has a separate row with its own figure: the 1972
  Eisenhower reverse types and the 1979 Anthony "near date" (wide rim) are not varieties. The
  Presidential edge-lettering errors ("Minting errors" section) are not varieties either.
- Mintages come only from the saved source, with separators removed, and are never summed, split or
  estimated; Total columns are ignored.
- Coins are in release order: designs in source order, then P, D (Anthony 1979–1981: P, D, S).

**Specs.** One file-level `specs` block per file, from that program's own infobox in the saved
response, with no per-coin overrides (no infobox shows a composition change; the Sacagawea edge
change of 2009 isn't stored):
- Presidential, Sacagawea and Native American, American Innovation: 26.49 mm, 8.1 g, 2.00 mm,
  "Manganese brass clad copper (88.5% copper, 6% zinc, 3.5% manganese, 2% nickel)".
- Eisenhower: 38.1 mm, 22.68 g, 2.58 mm, "Copper-nickel clad copper (91.67% copper, 8.33% nickel)".
- Susan B. Anthony: 26.5 mm, 8.1 g, 2.00 mm, "Copper-nickel clad copper (75% copper, 25% nickel
  outer layers, pure copper core)".

**Null mintages.** 25 coins, each because the source gives no figure for it:
- Native American 2023–2026 (8 coins): the "Mintage figures" table ends at 2022.
- American Innovation 2026 (8 coins): the mintage cells are "TBA".
- Susan B. Anthony 1979–1981 (9 coins): the prose gives only yearly totals (757,813,744 for 1979,
  89,660,708 for 1980, 9,742,000 for 1981), which are never split or assigned to one mint. The 1980
  mints are the infobox's P, D, S, since the prose doesn't name them. Only the 1999 P and D figures
  are per mint.

Presidential and Eisenhower have no null mintages.

**Excluded.** Proofs and reverse proofs (every San Francisco column, the Eisenhower "Proof:" list,
every Anthony proof), Special Mint Set and other set-only special finishes (the Sacagawea "Special
finish sets": 2000-D Burnished, 2014-D, 2015-W, 2016-S, 2017-S, 2019-P Enhanced Uncirculated), the
Eisenhower 40% silver S coins ("Uncirculated silver:" list and silver proofs), bullion, the 2000
"Cheerios" and other special strikes without rows of their own, and the announced but unissued
designs (the italic Native American 2027 row and every American Innovation row from 2027, Feature
"TBA"). `isKeyDate` is false throughout, since no cited source names key dates (the Eisenhower
article even says no Eisenhower dollar is rare), and there are no images. The designs from after
March 1989 need the per-design check in
[docs/catalog-data-licensing.md](../../../docs/catalog-data-licensing.md) before any image is added;
the catalog rows themselves are facts and need no such check.

**Not in production yet.** Running the import and `seed:canonical` against production is the
pending manual pass under growth backlog 2.9.

## `us-dollars-morgan.json` / `us-dollars-peace.json` (Morgan and Peace silver dollars)

119 large-size silver dollar business strikes (`country: "USA"`, `denomination: "Dollar"`, the same
denomination as the modern dollars above; the series are told apart by `name`), in two files:
`us-dollars-morgan.json` (name "Morgan Dollar", 1878–1904 and 1921, 95 coins) and
`us-dollars-peace.json` (name "Peace Dollar", 1921–1928 and 1934–1935, 24 coins).

**Provenance.** There is no "Morgan dollar mintage figures" or "Peace dollar mintage figures"
article, so the series articles are the sources. Each was fetched once on 2026-11-25 with
`pnpm run generate`, and the raw responses are saved unmodified under `../sources/` and cited in
each file's `sources[0]`:
- "Morgan dollar", revision 1385997217 (`../sources/Morgan_dollar.2026-11-25.json`).
- "Peace dollar", revision 1384400932 (`../sources/Peace_dollar.2026-11-25.json`).

Each article's "Mintage figures" table has one column per mint (Morgan: Year, Philadelphia, New
Orleans, San Francisco, Carson City, Denver; Peace: Year, Philadelphia, Denver, San Francisco, West
Point), which the generator does not parse: it saved each source, then exited with "No usable rows".
Every row was therefore read by hand (a scratch script over the saved wikitext: a non-empty cell with
a figure is one coin of that year and mint), no row was hand-corrected, and no draft was committed.
Coins are in table order: year, then the table's mint column order.

**Selection rules** (also in each file's `rules-note`):
- Business strikes only: Morgan 1878–1904 and 1921, Peace 1921–1928 and 1934–1935.
- The 1895 Philadelphia Morgan dollar is proof-only (the source gives "880 (proof only)"): it is not
  a business strike and is excluded on purpose, so there is no 1895 coin with a `null` mint mark.
  Collectors will look for it; the 1895 O and S business strikes are here.
- Mint marks are as on the coin: CC, O, S, D, and `null` for Philadelphia, which struck these coins
  without a mark. This departs from the modern dollar files' `"P"` and from
  [docs/adr/2026-11-24-unmarked-philadelphia-dollars-get-mint-mark-p.md](../../../docs/adr/2026-11-24-unmarked-philadelphia-dollars-get-mint-mark-p.md),
  which stays in force for those five files, and follows the `null` rule of the cents, nickels, dimes
  and 1932–1998 quarters.
- Varieties such as the 1878 8TF and 7TF tail-feather varieties are listed only where the source
  gives separate rows with their own figures. It gives one 1878 Philadelphia figure (10,508,800), so
  1878 Philadelphia is one coin with no variety. The 1921 Peace high relief issue has no separate row
  either and is that one 1921 Peace coin. VAM and other die varieties are not listed.
- The two 1921 Philadelphia coins would otherwise share a natural key (USA, Dollar, 1921, no mint
  mark), so the Morgan one has variety `Morgan` and the Peace one `Peace`. No other coin has a
  variety.
- Mintages only as the source gives them; nothing is summed, split or estimated.

**Specs.** One file-level `specs` block per file, from each article's infobox in the saved response,
no per-coin overrides: 38.1 mm, 26.73 g, 2.4 mm, "Silver (90% silver, 10% copper)" (Morgan: "90.0%
Silver / 10.0% Copper (1878–1904, 1921)"; Peace: ".900 silver, .100 copper", thickness 2.4 mm
1921–1935).

**Null mintages.** None.

**Key dates.** Morgan: `isKeyDate` is true for the 1893-S only, because the saved source's "Key date"
section names it: "The [[key date]] in the Morgan dollar series is the [[1893-S Morgan dollar]], which
was struck at the United States [[San Francisco Mint]]." The Morgan file records this in a
`keyDates` block (saved source path, verbatim quote, coin label), and the "Morgan Dollar Key Dates"
checklist lists that one coin. Peace: no cited source names key dates (the saved article has no key
date wording; its remarks on the 1921 and 1928 mintages are not key-date statements), so every Peace
coin has `isKeyDate: false` and there is no Peace key-date checklist.

**Checklists.** "Morgan Dollars 1878-1921" (95), "Morgan Dollar Key Dates" (1) and "Peace Dollars
1921-1935" (24) in `seed/templates/`.

**Excluded.** Proofs, including the 1895 Philadelphia Morgan; the 2021 and later collector Morgan and
Peace dollars; the 1964-D Peace dollars (316,106 struck, all destroyed and never issued); VAM and
other die varieties. No images.

**Not in production yet.** Running the import and `seed:canonical` against production is the
pending manual pass under growth backlog 2.9.

## `ukraine-commemorative-1-hryvnia.json` / `ukraine-commemorative-10-hryvnias.json`

46 circulating commemorative coins of Ukraine: 6 × 1 hryvnia (2004–2016, aluminium bronze, 26 mm,
6.8 g) and 40 × 10 hryvnias. Of the 10-hryvnia coins, 14 are first-type (2018–2022, nickel-plated
zinc alloy, 30 mm, 12.4 g, 2.8 mm, reeded edge) and 26 are second-type (2022–2026, 23.5 mm, 6.4 g),
including 12 from the "We Are Strong. We Are Together" oblast series. The file-level specs are the
second type's; each first-type coin overrides diameter, weight and thickness in its own `specs` and
inherits the material (the edge isn't stored). The original 31 coins match uCoin's "Commemorative
coins" list for the State of Ukraine (1992–2026) as of 2026-09-28; the 15 added on 2026-11-21 (the
14 first-type coins and the 2016 "20 Years of Monetary Reform in Ukraine" 1 hryvnia) aren't in that
list and were added to close the "Ukraine gaps" in docs/catalog-expansion-research.md.

**Coin subject goes in `variety`.** The `Coin` natural key is (country, denomination, year, mintMark,
variety) with no per-coin name, and many of these share a year and denomination (four 10-hryvnia
coins in 2024 alone). Putting the subject in `variety` keeps them distinct without a schema change;
`name` is the file-level series name.

**Sources.** uCoin only defined the scope: its footer prohibits republishing its text and images,
so nothing from it is copied. Subjects, years, mintages and specs come from Ukrainian Wikipedia's
"1 гривня (монета)" and "10 гривень (монета)" articles (facts only, see
[docs/catalog-data-licensing.md](../../../docs/catalog-data-licensing.md) §1). Subject names are our
own English renderings of the NBU's official Ukrainian titles. uCoin's "Service of the Armed Forces
of Ukraine" (2024) is the NBU's "Сили логістики ЗСУ" coin, so it's named "Logistics Forces" here.
Mintages: 5 million for each 1-hryvnia coin (7 million for 2015); 60,000 for the 2016 coin (10,000
in the "Монети України" set + 50,000 in souvenir packaging; the source calls it a circulating coin
but doesn't say it entered circulation); 10 million for each second-type 10-hryvnia coin from
2022–2025; 2 million for 2026 issues and for the oblast series. The 14 first-type coins have a
`null` mintage: the article gives one shared figure (1,000,000) for the type, not one per coin.

**Provenance of the 15 coins added on 2026-11-21.** Fetched through the MediaWiki API on 2026-11-21
from Ukrainian Wikipedia: "10 гривень (монета)" revision 49191096 (section "Монети першого типу",
read in full), "1 гривня (монета)" revision 49130450 (the fetch was truncated, but the 2016 entry was
in the part read) and "Монети української гривні" revision 49199060 (shows that the 2016 monetary
reform collector set holds the "Volodymyr the Great" 1 hryvnia, not this coin). **No raw captures
were saved under `sources/`**, and **the NBU cross-check was not done** because bank.gov.ua returned
HTTP 403; both are still to do. Nothing is copied from uCoin. The English subject names are our own
renderings of the NBU titles; each added coin records its Ukrainian title in `titleUk`, which the
import ignores. Each fixture's `sources` lists these revisions. The 2021 «Збройні сили України»
coin is `Ukrainian Armed Forces` rather than "Armed Forces of Ukraine", because the collection
import's variety matching would otherwise confuse it with the two other 2021 coins whose names
contain "of the Armed Forces of Ukraine" (a variety must not be a word-for-word subset of another
variety of the same year).

**Images.** None yet. Ukrainian coins are excluded from copyright (Commons tags such files
`{{PD-UAGov-Money}}`), but a photo can carry its own licence, so each file still needs the
Commons `extmetadata` check. `pnpm run find-images` (see `../README.md`, "Finding images") adds
an `image` block only where one Commons file clears that check; running it is a pending manual
step.

## `ukraine-<denomination>.json` (10 files: 1 kopiyka through 10 hryvnias)

187 coins covering the 26 circulation coin types on uCoin's "Circulation coins" list for the State of
Ukraine (1992–2026) as of 2026-09-28, one entry per year struck. There is one file per
denomination (`ukraine-1-kopiyka.json`, `ukraine-2-kopiyky.json`, … `ukraine-10-hryvnias.json`),
and each file has a `types-note` where a denomination has more than one type.

**Sources.** Same split as the commemoratives: uCoin set the scope (which types and year ranges),
but nothing from it is copied. The year list, mintages and specs come from Ukrainian Wikipedia's
"Монети української гривні", which has one table of mintages by year for every denomination.

**How years and mintages were chosen** (also recorded in each file's `rules-note`):
- A year is included when it falls inside a uCoin type range and Wikipedia shows the coin was struck that year.
- Probe strikes are excluded. This drops the 1992 1 hryvnia (150 pieces) and the 1992/1994 probe kopiyky.
- Set-only strikes are included, with the set mintage (usually 5,000–30,000).
- Coins "officially not issued but known to exist" are included, e.g. 25 kopiyok 1995 and 2003, and 10 kopiyok 2017.
- Where two types of one denomination overlap in a year, Wikipedia gives only a combined figure, so both entries have a null mintage. This applies to 10, 25 and 50 kopiyok in 2013–2016, and 1 hryvnia in 2013 and 2018.
- 1992 mintages for 10 and 25 kopiyok add the Italian and Luhansk strikes together.
- The 1992 "English strike" 10, 25 and 50 kopiyok are separate varieties with unknown mintage.

**Variety.** `null` for a denomination's main type. It's set only for a second type in the same
years: "Brass-plated steel" for kopiyky; "Volodymyr the Great" and "2018 design" for 1 hryvnia;
"English strike" for 1992. These never collide with the commemorative varieties that share the
"1 Hryvnia" and "10 Hryvnias" denominations.

**Materials** follow Wikipedia, so the 1992–2016 10/25/50 kopiyok are "Aluminium bronze" (uCoin says
brass for 1992–1996). Thickness is null for 2 kopiyky and 2 hryvni, where the source doesn't give it.

**Not included.** The 1 kopiyka 2019, left out by decision on 2026-11-21. "Монети української
гривні" (revision 49199060) marks it `***` (officially not issued, but exists) with no mintage
figure, and it isn't in the 2019 collector set; it also falls outside uCoin's 2000–2018 range. The
`***` rule above would otherwise include it, so this is a deliberate exception.
`isKeyDate` is false throughout, since no source flags key dates. There are no images yet: they
are added by `pnpm run find-images` (see `../README.md`, "Finding images") after the per-file
Commons licence check, a pending manual step.
