# Competitor analysis

Research pass done 2026-11-16 from public pages (vendor sites, help pages, user forums). Nothing here was tested hands-on with an account, and features change, so re-check a competitor's own pages before relying on a specific claim. Sources are listed at the end.

**Read this first:** most "best coin app" roundups found in search are sponsored or written to rank, and they disagree with each other. They were used only to confirm that a product exists and what kind of product it is, never for quality claims.

## The main idea this is measured against

Coin Collector Companion answers one question: **what am I still missing from a set I defined myself?** ([prd_v2.md](prd_v2.md), Problem & Context). Every feature decision below is judged by whether it feeds coins into that gap view, makes the gap view more accurate to the collector's real goal, or gets the gap list into the collector's hands when they need it.

## Who is out there

| Product | What it is | Strength | Where the gap view idea is weak or absent |
| --- | --- | --- | --- |
| **Numista** | World catalogue with a collection manager, swaps between members and wish lists | Catalogue size, community, swap network, values from realised sales | Wish list works at coin-type level; a request for wish list by year has been open for years with strong support. Members describe building a missing-years list by hand before a coin show. "Missing" (catalogue minus owned) and "wish list" are separate, and users ask how they relate |
| **uCoin** | World catalogue with collection and swap | Reported by a Numista member to already support year-level wants | Not checked directly in this pass |
| **Colnect** | Catalogues for many collectibles, with collection, swap and wish lists, automatic matching between members, and a marketplace | 400,000+ collectors by its own count; matching and marketplace; custom lists added recently | Built around trading. Spreadsheet download is a premium feature |
| **PCGS Set Registry** | Competitive registry of graded sets | 200,000+ registered sets; rankings, awards; described by a dealer as a digital press-in album | Only PCGS-graded coins count toward sets. Sets are defined by PCGS; collectors request new ones |
| **NGC Registry** | Competitive and custom sets of certified coins | Custom sets let the collector define the theme and eligible coins | Certified coins only. Custom sets are not yet in the new registry and remain on the older site |
| **Identifier apps** (CoinSnap, Coinoscope, Maktun, CoinKnow and similar) | Photo identification and valuation on a phone, with a collection list attached | Huge install base; instant identification; Maktun's catalogue works offline | Collection is a flat inventory. No self-defined sets, no completion tracking |
| **Inventory managers** (OpenNumismat, CoinManage, USA Coin Book, Foronum) | Detailed per-coin records: purchase data, photos, reports, want lists | Depth of record keeping; OpenNumismat is free with 80+ fields | Inventory first. Foronum puts Excel import and export behind a subscription |

## What this means

**1. The main idea is confirmed, and by the competitors' own users.** The clearest evidence is on Numista's forum: collectors ask for a want list at year level, describe preparing a missing list by hand for shows, and ask for a way to mark a coin as owned but wanted in better condition. This app already does all three inside a set (per-coin rows with year and mint mark, the missing page with print and CSV, minimum grade with "needs upgrade"). These are the features to lead with.

**2. There is an open position: a set registry for ordinary coins.** The registries prove collectors love completing sets and showing progress, but they require certified coins and mostly fixed set definitions. Most collectors' coins are uncertified. "Build any checklist, track it with the coins you actually have" is a position neither the registries nor the catalogues hold.

**3. Do not compete on catalogue size.** The large catalogues list hundreds of thousands of types built by communities over many years. The realistic route is depth in a few series people collect by date and mint mark, user submissions for the rest, and import from the tools collectors already use.

**4. Do not compete on swaps, marketplace, identification or valuation.** Each is someone else's core product and depends on a network or a data source this project does not have. All four also sit outside the main idea.

**5. Switching cost is real.** Collectors already have years of data in Numista, Colnect, uCoin or a spreadsheet. Import is how they try this app without retyping, which the PRD already names as the moat.

## Feature decisions

| Feature | Decision | Why |
| --- | --- | --- |
| Want list by year and mint mark, usable offline | **Keep, raise priority** (Step 5) | The most requested thing competitors' users lack; it is the gap view in the collector's pocket |
| "Needs upgrade" coins on the want list | **Add** (Step 5) | Asked for on Numista; minimum grade already exists here |
| Shareable progress | **Keep** (Step 4) | Registries show collectors want to show a set; this is the uncertified-coin version |
| Sets that stay current when the catalogue grows | **Add** (new Step 6) | A filter-built set is a snapshot today. New issues and newly imported coins should be offered to the sets whose filter they match, or the gap view goes stale |
| Import presets for other tools' exports | **Keep, widen** (Step 7) | Lowers switching cost; feeds coins straight into the gap view |
| Type-set slots: a slot filled by any one of several coins | **Add as parked** (Step 8) | Type collecting is a mainstream goal, and a Numista member describes wanting "any one of twenty". Needs a data-model change, so it waits for a PRD decision |
| Quantities, notes, purchase price | **Demote** (Step 9) | Inventory-manager territory, well served elsewhere, and it does not change what is missing |
| Own-coin photos | **Drop from the backlog** | Inventory feature with storage and moderation cost; outside the main idea |
| Swap matching, marketplace | **Stay out** | Network-effect products; PRD non-goals |
| Photo identification, valuation | **Stay out** | Crowded, needs data this project cannot license today |
| Rankings and leaderboards | **Stay out** | The registries own this; it rewards spending, not completing your own goal |
| Theme tags on public sets, marketplace links | **Keep parked** (Step 10) | Discovery and monetisation ideas; only useful once there is traffic |

## Positioning lines to test on the landing page

- "See what you're still missing." (the main idea, unchanged)
- "Your checklist, your rules: any coins, any years, no grading service required."
- "Take your want list to the show."

## Sources

- [About Numista](https://en.numista.com/info.php) and the [Numista home page](https://en.numista.com/)
- Numista forum: [Wish list by year (open request)](https://pl.numista.com/forum/topic45624.html), [Yearwise collector report](https://tr.numista.com/forum/topic86609.html), [Wish list and missing coins](https://tr.numista.com/forum/topic115148.html), [Swap page change suggestion](https://tr.numista.com/forum/topic91240.html), [Wish list (founder's design thread)](https://el.numista.com/forum/topic2055.html), [Values and new collection management](https://tr.numista.com/forum/topic67354.html)
- [PCGS Set Registry FAQ](https://www.pcgs.com/setregistry/faq), [Set Registry home](https://www.pcgs.com/setregistry), [PCGS 2026 awards announcement](https://www.pcgs.com/news/professional-coin-grading-service-elevates-pcgs-set-registry), [Drake Sterling: how to use the Set Registry](https://www.drakesterling.com/news/post/pcgs-set-registry-how-to-use)
- [NGC Registry FAQs](https://www.ngccoin.com/about/help-center-faqs/ngc-registry/ngc-registry-faqs/)
- [Colnect on Wikipedia](https://en.wikipedia.org/wiki/Colnect), [Colnect blog 2026](https://blog.colnect.com/2026)
- [Foronum user guide](https://en.foronum.com/coin-guides/foronum-user-guide)
- [OpenNumismat](https://opennumismat.github.io/open-numismat)
- [USA Coin Book catalog tool](https://www.usacoinbook.com/catalog-coins.php)
- Identifier apps (existence and category only): [CoinKnow vs Maktun](https://theprint.in/brandit/coinknow-vs-maktun-reviews-which-coin-identifier-app-is-better/2899479/), [App Store listing roundup](https://appshunter.io/ios/topics/coin-collection)
