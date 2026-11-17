# Marketing plan: no or low investment

Written 2026-11-16. Companion to [backlog_growth.md](backlog_growth.md) (what to build) and [competitor-analysis.md](competitor-analysis.md) (who else is out there). This doc covers how people find out about the app.

**Budget:** one domain, roughly $10-15 a year. It is needed anyway for password-reset email (growth backlog 0.8). Everything else here costs time, not money.

**Not checked:** the rules and current activity of the specific communities named below. Read each one's self-promotion rules before posting.

## The decision this plan depends on

The PRD describes a portfolio piece and personal tool. This plan assumes the goal is now real users. If it isn't, only "Phase 0" and the developer-community launch in Phase 2 are worth doing. Record the answer in `prd_v2.md` (growth backlog, "Open question to settle before Step 2").

## Who it is for

Collectors who fill sets by date and mint mark from ordinary, uncertified coins, and who today track what they lack in a spreadsheet, a paper list or their head.

Start with two groups, not everyone:

1. **Collectors of Ukrainian coins.** The catalog is already the second largest here, Andrew knows the community and the language, and there is far less competition than for US coins.
2. **Lincoln cent collectors.** The most complete series in the catalog and one of the most collected in the world.

Add a group only when its series is fully in the catalog with a curated checklist.

## What to say

| Line | Use it for |
| --- | --- |
| "See what you're still missing." | Headline everywhere |
| "Your checklist, your rules: any coins, any years, no grading service required." | Collectors who know the grading-service registries |
| "Take your want list to the show." | Collectors who buy at shows and shops |

Always show the gap view itself (a screenshot or the live demo), not a description of it. Say plainly that the app is free and built by one collector.

Do not claim a large catalog. Say which series are covered, and that missing coins can be submitted.

## Phase 0: before telling anyone

Marketing sends people to the landing page. These decide whether they stay. All are growth backlog items.

- [ ] Domain bought and connected to the web app; sending domain verified (0.8).
- [ ] Analytics live (0.6), so each channel's visitors can be told apart. Use a different link tag per post.
- [ ] Landing page shows a working gap-view demo and the API is warm (Step 1).
- [ ] Ukrainian UI locale (2.8), before posting in Ukrainian communities.
- [ ] A free printable checklist (PDF) for Lincoln Wheat cents and for Ukrainian circulation coins, generated from the existing print styles. This is the thing to give away in posts.
- [ ] The feedback form is easy to find, and feedback is read daily during launches.

## Phase 1: the first 10-20 users, by hand (weeks 1-2)

Goal: learn whether people come back in their second week. Sign-up counts don't matter yet.

- [ ] Post in Ukrainian collector groups where Andrew is already a member (forums, Facebook, Telegram). Frame: "I collect, I built this for myself, it's free, tell me what's wrong with it."
- [ ] Message five to ten collectors directly and offer to set up their first checklist with them on a call or in chat. Note every point where they get stuck.
- [ ] Fix the most common complaint within days and tell the people who raised it.
- [ ] Ask each early user which series they want next. Their answers order Step 2 of the backlog.

**Move on when:** at least five people who are not friends have marked coins in two different weeks.

## Phase 2: community launches (weeks 3-6)

One channel per week, so results can be compared and problems fixed between launches.

- [ ] **English-language coin communities** (r/coins, r/coincollecting, CoinTalk). Take part in discussions for a week or two first. Lead with the free printable checklist; mention the app as the interactive version.
- [ ] **Numista forum.** Many members there ask for a year-level want list (see the competitor analysis). Offer the app as a companion for tracking a set, not as a replacement. Only relevant once import from other tools exists (backlog Step 7), so this may come later.
- [ ] **Developer communities** (Show HN, Indie Hackers, dev.to). The story is the build: a solo developer, an AI orchestrator with its own verification pipeline, ADRs, 865+ commits. This serves the portfolio goal and brings links that help search ranking.
- [ ] **Small coin YouTubers and bloggers.** Offer to build a curated checklist that matches one of their videos or posts. It costs about an hour and gives them something to link.
- [ ] **Local clubs and shows.** A printed sheet with a QR code to the want-list page, left with the club or handed out. Costs a few prints.

Post template (adapt per community):

> I collect [series] and got tired of working out what I still need before every show, so I built a free tool that shows exactly which dates and mint marks are missing from a set. Here's a printable checklist for [series]: [link]. The interactive version is at [link]. It covers [list of series] so far. What would you want it to do that it doesn't?

## Phase 3: channels that grow by themselves (ongoing)

These are features, already in the backlog. They are the reason marketing effort drops over time.

- **Search pages** (Step 3). Every curated checklist becomes a page that can rank for "[series] checklist". Each series added in Step 2 adds pages.
- **Shareable progress** (Step 4). A collector posting "87% complete, 12 to go" shows the app to exactly the right people.
- **Want list at shows** (Step 5). People see it being used.
- **Requests as content.** When someone asks for a series, add it, then reply in the same thread.

Content worth writing, once a month at most, each tied to a checklist page:

- "Key dates in [series] and why they're hard to find"
- "How to build a [series] set on a small budget"
- A build log post for developers

## What not to do

- **Paid ads**, until the two conditions under "When to spend money" are met.
- **Posting the same message to many groups in one day.** It reads as spam and gets accounts removed.
- **Messaging strangers in bulk** or collecting contact details from forums.
- **Paid listings in "best coin app" roundups.** Most are sponsored and collectors don't trust them.
- **Launching everywhere at once.** A weak first impression can't be retried in the same community.

## When to spend money

Only after both are true:

1. Visitors from free channels come back in their second week.
2. It is clear which series they collect.

Then run one small test (about $20-30) aimed at that single series, and compare its cost per active user with the free channels. Keep it only if it wins.

## What to measure

Per channel, in this order:

1. Visits
2. Sign-ups
3. First set created
4. Five coins marked owned
5. A return visit in the second week

A channel is worth repeating when its visitors reach step 5. Review weekly during Phases 1-2 and write the numbers into `docs/history.md`.

## First four weeks

| Week | Do |
| --- | --- |
| 1 | Finish Phase 0. Draft the Ukrainian post and the printable checklists |
| 2 | Phase 1: Ukrainian groups and direct conversations. Fix the top complaint |
| 3 | First English coin community. Review numbers at the end of the week |
| 4 | Developer-community launch. Decide the next series from user requests |
