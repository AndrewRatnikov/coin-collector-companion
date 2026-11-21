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

## `ukraine-commemorative-1-hryvnia.json` / `ukraine-commemorative-10-hryvnias.json`

31 circulating commemorative coins of Ukraine, matching uCoin's "Commemorative coins" list for the
State of Ukraine (1992–2026) as of 2026-09-28: 5 × 1 hryvnia (2004–2015, aluminium bronze, 26 mm,
6.8 g) and 26 × 10 hryvnias (2022–2026, nickel-plated zinc alloy, 23.5 mm, 6.4 g), including 12 from
the "We Are Strong. We Are Together" oblast series.

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
Mintages: 5 million for each 1-hryvnia coin (7 million for 2015); 10 million for each 10-hryvnia
coin from 2022–2025; 2 million for 2026 issues and for the oblast series.

**Not included.** The 14 first-type 30 mm, 12.4 g 10-hryvnia commemoratives from 2018–2022 and the
2016 "20 years of monetary reform" 1 hryvnia aren't in uCoin's list. Images aren't included either:
they need the Commons `extmetadata` check before they can be added.

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

**Not included.** The 1 kopiyka 2019, which exists but falls outside uCoin's 2000–2018 range.
`isKeyDate` is false throughout, since no source flags key dates. There are no images.
