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

**Not included.** Images: they need the Commons `extmetadata` check before they can be added.

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
`isKeyDate` is false throughout, since no source flags key dates. There are no images.
