# robots.txt allows every crawler, AI training bots included, with one explicit group per named bot that repeats the disallow list

- **Status:** Accepted
- **Date:** 2026-11-27
- **Source:** orchestrator run `run_20261127_065505` (search visibility phase 1, growth backlog 3.9; the allow-everything policy and the named bot list came from the task brief)
- **Code:** `apps/web/src/app/robots.ts`, `apps/web/src/app/robots.test.ts`

## Context

Step 3 of `docs/backlog_growth.md` is about being found by search engines and AI agents. `robots.txt` is where the site says which crawlers may read what. The crawlers that matter fall into three kinds: AI search (OAI-SearchBot, Claude-SearchBot, PerplexityBot), user-triggered fetchers (ChatGPT-User, Claude-User, Perplexity-User) and training crawlers (GPTBot, ClaudeBot, Google-Extended, CCBot). The signed-in and auth-only pages have nothing to index.

A crawler obeys only the most specific `User-agent` group that matches it. A named group therefore replaces the `*` group for that bot instead of adding to it.

## Decision

`robots.ts` allows `/` for every user agent, including the training crawlers, and disallows the signed-in and auth-only paths (`DISALLOWED_PATHS`: `/dashboard`, `/collection`, `/want-list`, `/settings`, `/admin`, `/sets/new`, `/sets/*/missing`, `/login`, `/signup`, `/forgot-password`, `/reset-password`).

It emits the `*` group plus one explicit group for each bot in `AI_CRAWLER_USER_AGENTS` (OAI-SearchBot, ChatGPT-User, GPTBot, Claude-SearchBot, Claude-User, ClaudeBot, PerplexityBot, Perplexity-User, Google-Extended, CCBot). Every group has `allow: '/'` and repeats the full disallow list, so a named bot is never allowed into a path the `*` group blocks. The sitemap line is `${siteOrigin()}/sitemap.xml`.

Both lists live at the top of the one file. To block a bot, give its group `disallow: '/'`. The README documents this.

## Alternatives considered

- **Allow search and user-triggered bots, block the training bots.** Rejected: the goal of Step 3 is maximum visibility in AI answers, and the catalog data is already published under CC BY-SA 4.0 (derived from Wikipedia), so withholding it from training crawlers protects little.
- **Rely on the `*` group only.** Rejected: the per-bot policy would not be visible in the file and would need a new group written, with the disallow list copied, every time someone wanted to change one bot.

## Consequences

- The policy is a visible per-bot list, and changing one bot is a one-line edit.
- Each named group copies the disallow list. Adding a path means editing `DISALLOWED_PATHS` only, because the groups are built from it. A hand-written group that skipped the list would let that bot into signed-in paths.
- Allowing training crawlers is a content-licensing choice the owner made. Revisit it if the catalog gains content that is not CC BY-SA, such as user-written text, or if training use becomes a concern.
- `robots.txt` is advisory. The signed-in paths are protected by auth, not by this file.
