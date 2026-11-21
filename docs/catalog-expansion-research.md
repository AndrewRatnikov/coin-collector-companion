# Catalog expansion: research and recommendation

Research pass done 2026-11-21. Andrew asked how to grow the catalog as part of the growth plan. This doc covers which coins to add first, where the data comes from, what the licensing rules allow, and what has to change in the code before the catalog gets much bigger. It feeds Step 2 of [backlog_growth.md](backlog_growth.md) and follows the rules in [catalog-data-licensing.md](catalog-data-licensing.md).

**Not legal advice.** The licensing notes below are a reading of public policy pages, not a lawyer's opinion.

## Where the catalog is today

- 360 coins in `scripts/import-catalog/fixtures`: 142 Lincoln Wheat cents, 187 Ukrainian circulation coins, 31 Ukrainian circulating commemoratives. 5 curated sets in `seed/templates`.
- No coin has an image. Every fixture's README says images are still waiting for the per-file Commons check.
- Every fixture was written by hand from Wikipedia tables. There is no fetch step yet (`scripts/import-catalog/README.md`).
- The Ukrainian commemoratives are up to date: the fixture already has the 2026 oblast coins and the 28 July 2026 "In Memory of Those Executed" coin. The NBU says the oblast series continues through 2026-2027, so this fixture needs a refresh routine, not a one-off import.

## Recommendation in one paragraph

Grow in depth, not breadth, and in the order of the two audiences the marketing plan already picked: Ukrainian collectors and Lincoln cent collectors. First fix three things that get worse with every coin added (a fixture generator, a denomination convention, and a faster import). Then finish Ukraine (the NBU's nickel-silver commemoratives, plus Ukrainian coin images, which are public domain by law) and Lincoln cents through 2025. Then modern US quarters, then the other US 20th-century series, then Morgan and Peace dollars. Euro coins come last: the biggest audience, but also the biggest dataset, a different legal setting, and the clearest need for the code changes. Do not use Numista or uCoin data.

## Candidate series

Row counts are estimates worked out from years times mints (business strikes only, no proofs). The fixture generator in "Before adding coins" gives the exact numbers.

| Series | Rows (est.) | Data source | Licensing status | Fit | Order |
| --- | --- | --- | --- | --- | --- |
| Ukraine: NBU nickel-silver commemoratives (2 and 5 hryvnias) | several hundred | NBU annual "Банкноти і монети України" catalogs; Ukrainian Wikipedia lists | Facts: clear. Images: Ukrainian coins are excluded from copyright by law (see below) | Audience 1; the affordable series Ukrainian collectors actually fill | 1 |
| Ukraine: gaps in the current fixtures | ~16 | Same as the existing fixtures | Clear | Audience 1; small | 1 |
| Lincoln Memorial cents 1959-2008, Bicentennial 2009, Shield cents 2010-2025 | ~150-170 | Wikipedia "United States cent mintage figures" | Facts: clear. Images: post-1989 designs need the per-design check | Audience 2; completes the most common US album | 1 |
| Modern quarters: 50 States, DC and Territories, America the Beautiful, Crossing the Delaware, American Women, 2026 Semiquincentennial | ~280 (P and D) | Wikipedia "Washington quarter mintage figures" (one article covers all of them) | Facts: clear. Images: per-design check (Artistic Infusion designers are contractors) | The most widely collected US series from pocket change | 2 |
| Jefferson nickels 1938-2026 | ~200 | Wikipedia "United States nickel mintage figures" | Facts: clear. Images: pre-1989 designs PD; Westward Journey and later need the check | Mainstream US date set | 3 |
| Roosevelt dimes 1946-2026 | ~170 | Wikipedia "Roosevelt dime mintage figures" | Same as nickels | Mainstream US date set | 3 |
| Washington quarters 1932-1998 | ~150 | Wikipedia "Washington quarter mintage figures" | Pre-1989 designs PD | Mainstream US date set | 3 |
| Morgan dollars 1878-1921, Peace dollars 1921-1935 | ~96 + 24 | Wikipedia "Morgan dollar", "Peace dollar" | Pre-1989 designs PD (already cleared in catalog-data-licensing.md) | Popular, but bought rather than found; key-date sets are the draw | 4 |
| €2 commemoratives 2004 onward | ~600, about 25 a year more | Wikipedia "2 euro commemorative coins"; Official Journal notices | Facts: use open sources only (EU database right). Images: euro designs are copyrighted, skip | Large audience across 25 issuers; collected from change | 5 |
| Standard euro coins by country, 2002 onward | several thousand (Germany alone ~1,000: 8 values x 5 mints x 25 years) | Wikipedia per-country "euro coins" articles | Same as €2 commemoratives | Large, but a big dataset for a small team | 6 |

Why these sizes matter: the €2 commemoratives alone would grow the catalog by more than the whole current catalog. Wikipedia counts 584 variations issued by the end of 2025, and each country may issue at most two a year (plus joint issues). Bulgaria became the 21st eurozone country on 1 January 2026, so there is one more issuer from this year.

### Notes on specific series

- **Ukraine gaps.** The fixture README already lists what was left out: the 14 first-type 30 mm 10-hryvnia commemoratives (2018-2022), the 2016 "20 years of monetary reform" 1 hryvnia, and the 1 kopiyka 2019. These are cheap to add and close questions a Ukrainian collector will ask in the first week.
- **NBU commemoratives.** This is the big Ukrainian series. A Kharkiv university thesis counts 968 jubilee and commemorative NBU coins across all metals; the nickel-silver ones (2 and 5 hryvnias) are the ones most people collect. Start with nickel silver only. The NBU publishes a yearly PDF catalog (for example "Банкноти і монети України 2024") with metal, diameter, date of issue and mintage for every coin, which is a good official cross-check. Put the coin subject in `variety`, as the current commemorative fixtures do.
- **Lincoln cents through 2025.** Circulation pennies have stopped: per the Congressional Research Service, the 2026 cent is sold only in collector products. That gives the Lincoln cent set a natural end date (2025) for the curated checklist. Include the 1982 copper and zinc types and the four 2009 Bicentennial designs as varieties.
- **Modern quarters.** One Wikipedia article covers every Washington quarter type through the American Women program, so one generator run covers the whole group. The 2026 program adds five designs (Mayflower Compact, Revolutionary War, Declaration of Independence, Constitution, Gettysburg Address). State names and park names go in `variety`.
- **Proofs and special mints.** No current fixture has proofs (the Lincoln fixture has none), and the catalog has no strike-type field. Keep it that way for the first waves: business strikes only, plus the circulating W-mint quarters of 2019-2020. Proofs can come later as a `variety` once someone asks.

## Licensing: what changes beyond the current doc

1. **The post-1989 design check is about images, not rows.** `catalog-data-licensing.md` marks State Quarters "not cleared yet", and CLAUDE.md says US designs from March 1989 onward need a per-design check. That check decides whether a *picture* of the coin can be shown. The identity facts (year, mint, variety, mintage) are facts either way. So the modern US series can be imported now without images, with the per-design check done later for images only. Suggest rewording the CLAUDE.md line so it doesn't read as blocking the rows.
2. **Ukrainian coin images are allowed.** Under Ukrainian law, coins are excluded from copyright. Commons' rules page for Ukraine says Ukrainian currency is not copyrighted (Article 10 of the copyright law excludes money along with other state symbols) and has a dedicated tag, `{{PD-UAGov-Money}}`, for such images. The existing per-file `extmetadata` gate still applies (a photo can carry its own license), but most Ukrainian coin images on Commons should pass it. This would make Ukraine the first part of the catalog with images, which matters for the first audience. Not checked: whether the 2022 copyright law (2811-IX) kept the same exclusion word for word; Commons' rules page cites the older law.
3. **Euro data needs a different argument.** The "facts aren't copyrightable" reasoning in the licensing doc is US law (*Feist*). In the EU, a collection of facts can still be protected: the Database Directive's sui generis right stops anyone copying all or a substantial part of a database that took substantial investment to build. So for euro coins, take data only from openly licensed or public sources: Wikipedia (CC BY-SA 4.0, which licenses database rights too) and the EU Official Journal, where each new national side is published with its estimated mintage and issue date. Under Decision 2011/833/EU, Commission documents are free to reuse, commercially or not, with attribution. Do not copy from national mint shops, ECB pages beyond single facts, or coin-collector sites.
4. **Euro images: skip.** The European Commission holds the copyright on the common sides of euro coins. National sides belong to each country. The current gate reads only the photo's license from Commons, which doesn't capture the design copyright, so euro images would need a country-by-country rule. Not worth it for the first euro wave.
5. **Numista stays out.** It's on the CLAUDE.md scope firewall, and nothing here needs it. uCoin stays a scope reference only, as in the current fixtures (its footer forbids republishing). OpenNumismat's app is GPL-3.0, but that covers the software, not its downloadable catalogs; the PRD's "email the author first" note still stands if anyone wants those.

## Before adding coins: three code changes

Each of these is small now and gets more expensive with every series.

1. **Fixture generator.** Today each fixture is typed by hand from a Wikipedia table. Add a script under `scripts/import-catalog/` that fetches a mintage article through the MediaWiki API (with the descriptive `User-Agent` the licensing doc requires), parses the year/mint/mintage tables, and writes a fixture JSON in the existing raw shape, with the `sources` block filled in. A person still reviews the diff before import. This is what makes the quarter, nickel and dime series a few hours each instead of days.
2. **Denomination convention and sort order.** `compareDenominations` and `getDenominationNumeral` in `packages/shared` sort by the first number in the denomination string, and a denomination with no number counts as 1. That already mis-sorts Ukrainian coins ("50 Kopiyok" sorts after "10 Hryvnias"), and US names would break further: "Nickel", "Dime", "Quarter" and "Dollar" would all read as 1, sort alphabetically, and show "1" on the coin placeholder. Decide one convention before importing more US coins. Two options:
   - Spell values out ("5 Cents", "10 Cents", "25 Cents", "1 Dollar", "2 Euro", "50 Euro Cent") and keep the existing "Cent" rows as they are, or rename them with a data migration (the denomination is part of the natural key, so `seed/templates` would change too).
   - Add a face value to the coin (a number in the currency's main unit, so 50 kopiyok = 0.5) and sort by that. Cleaner, but a migration and a PRD-level data model change.
3. **Faster import.** `import-coins.ts` does a `findUnique` and then a `create` or `update` per coin, one at a time. That's fine for 360 rows. A full euro import of several thousand rows means two network round trips each against Neon. Batch per file (one transaction, or `createMany` with `skipDuplicates` plus updates only for changed rows) before the euro wave.

Two more things to schedule alongside, both already in the growth backlog:

- **Step 6, sets that stay current**, matters more once the catalog grows: a set built from "USA, Quarter" today won't pick up the State Quarters when they arrive.
- **Every series ships with a curated checklist** (Step 2's rule). The key-date sets are worth the extra effort for Lincoln cents, Morgans and Peace dollars; for the modern quarters, one checklist per program.

## Let demand decide the order after wave 2

The order above is a guess for waves 3 onward. Three cheap signals would replace it with data:

- **Catalog searches with no results.** Add one analytics event when a catalog filter or name search returns nothing, with the filter values (no user data). This is the most direct demand signal there is. It fits the cookieless PostHog setup in the 2026-11-20 ADR.
- **The submission queue.** Coins people submit are coins they own and couldn't find. Group pending submissions by country and denomination once a month.
- **Ask the first users**, as the marketing plan's Phase 1 already says.

## Suggested waves

| Wave | Contents | Rows added (est.) |
| --- | --- | --- |
| 0 | Fixture generator, denomination convention, batched import | 0 |
| 1 | Ukraine gaps, NBU nickel-silver commemoratives, Ukrainian images; Lincoln cents 1959-2025 with a full 1909-2025 checklist | ~500-700 |
| 2 | Modern US quarters (States through Semiquincentennial) | ~280 |
| 3 | Jefferson nickels, Roosevelt dimes, Washington quarters 1932-1998 (order by demand signals) | ~520 |
| 4 | Morgan and Peace dollars with key-date sets | ~120 |
| 5 | €2 commemoratives (after the denomination decision) | ~600 |
| 6 | Standard euro coins, one country at a time, by demand | thousands |

After waves 1-4 the catalog would be about 1,800-2,000 coins, five to six times today's, with every row from an open source and Ukraine fully illustrated.

## Decisions for Andrew

1. Settle the growth backlog's open question first (portfolio piece or real users). Waves 1-6 only make sense for the second.
2. Denomination convention: spelled-out values, or a face-value field.
3. Proofs: confirm "business strikes only" for now.
4. Wording change in CLAUDE.md and catalog-data-licensing.md: the post-1989 check applies to images, not catalog rows.

## Sources

- [Wikipedia: United States nickel mintage figures](https://en.wikipedia.org/wiki/United_States_nickel_mintage_figures), [Roosevelt dime mintage figures](https://en.wikipedia.org/wiki/Roosevelt_dime_mintage_figures), [Washington quarter mintage figures](https://en.wikipedia.org/wiki/Washington_quarter_mintage_figures), [United States cent mintage figures](https://en.wikipedia.org/wiki/United_States_cent_mintage_figures)
- [Wikipedia: 2 euro commemorative coins](https://en.wikipedia.org/wiki/2_euro_commemorative_coin)
- [CRS: Commemoration of the 250th Anniversary, Coins and Medals (2026-02-06)](https://www.everycrsreport.com/files/2026-02-06_IF13165_f9855c6d4972d67b7b51a4ecb8b385219779962c.html)
- [Numismatic News: New circulating coins celebrate the 250th](https://www.numismaticnews.net/new-circulating-coins-celebrate-the-250th)
- [Commons: Copyright rules by territory/Ukraine](https://commons.wikimedia.org/wiki/Commons:Copyright_rules_by_territory/Ukraine)
- [NBU: Банкноти і монети України 2024 (PDF)](https://bank.gov.ua/admin_uploads/article/Banknotes-and-coins-of-Ukraine_2024.pdf)
- [Kharkiv National University thesis on NBU commemorative coins (PDF)](https://ekhnuir.karazin.ua/bitstreams/879bcad6-6d4a-490e-b1b2-f454507a4b39/download)
- [European Commission: Copyright and reproduction rules of euro coins and notes](https://economy-finance.ec.europa.eu/euro/euro-coins-and-notes/copyright-and-reproduction-rules-euro-coins-and-notes_en)
- [Commission Decision 2011/833/EU on the reuse of Commission documents](https://eur-lex.europa.eu/eli/dec/2011/833/oj)
- [Wikilegal: Database Rights](https://meta.wikimedia.org/wiki/Wikilegal/Database_Rights)
- [Coinection: Bulgaria joining the Eurozone](https://coinection.eu/article/bulgaria-joining-the-euro)
- [Finance.ua: NBU oblast series continues through 2026-2027](https://news.finance.ua/ru/nbu-vypustil-tri-novye-oborotnye-pamyatnye-monety-foto)
- [OpenNumismat manual (licence)](https://opennumismat.github.io/open-numismat/manual.html)
