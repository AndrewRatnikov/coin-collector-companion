# Commons requests are paced at 1 s and retried on 429, 5xx and network failures, with at most 4 attempts and 60 s per wait

- **Status:** Accepted
- **Date:** 2026-11-22
- **Source:** orchestrator run `run_20261122_084533` (images for the Ukrainian part of the catalog; change request in the user's answer after a real `--dry-run` failed on HTTP 429)
- **Code:** `scripts/import-catalog/lib/commons.ts`, `scripts/import-catalog/lib/find-images.ts`, `scripts/import-catalog/find-images.ts`, `apps/api/scripts/import-catalog-commons.spec.ts`

## Context

The first plan sent Commons requests one at a time but back to back, with no pause and no retry. The first real `find-images --dry-run` on Andrew's machine, with `WIKIPEDIA_CONTACT` set, died in the middle of the category crawl with `HTTP 429` on `Category:Odesa Oblast on coins`. Wikimedia's rate limiter cut the crawl off and the first 429 aborted the whole run. `docs/catalog-data-licensing.md` still requires sequential requests and a descriptive User-Agent, so parallelism was not an option.

## Decision

`lib/commons.ts` paces and retries every Commons request, the category crawl and the imageinfo batches alike.

- Before each request it awaits `sleep(REQUEST_DELAY_MS)` (1000 ms). Requests stay strictly sequential.
- HTTP 429, any HTTP 5xx, and a thrown fetch or body read are retried, up to `MAX_ATTEMPTS` (4) attempts in total, the first included.
- The wait before a retry is the `Retry-After` header when it is an integer number of seconds (never less than the 1 s pause), otherwise exponential backoff of 2 s, 4 s, 8 s (`RETRY_BASE_DELAY_MS`). An HTTP-date `Retry-After` is ignored and the backoff applies.
- Every wait is capped at `MAX_RETRY_WAIT_MS` (60 s). If `Retry-After` asks for more, the request gives up at once.
- After the last attempt, or on a too-long `Retry-After`, it throws `CommonsApiError`. The run exits 1 and writes nothing, because all fixture writes happen after the last request. Each retry is reported through `onRetry`, which the command wires to stderr.
- Other non-OK statuses (4xx), non-JSON bodies and API `error` bodies fail at once, without retry.
- `sleep` is injected (`CommonsPacing.sleep`, `FindImagesDeps.sleep`, both required). The entry file passes a real `setTimeout`; specs pass a fake one, so they run instantly with no real timers and no network.

## Alternatives considered

- **No retries** (the earlier plan). Rejected: it aborts a real run on the first 429, which is what happened.
- **Retries with no pause.** Rejected: it keeps tripping the rate limiter and treats the symptom.
- **Parallel requests with a token bucket.** Rejected: the licensing doc requires sequential requests.
- **Uncapped waits or attempts.** Rejected: a run could hang.
- **Retrying API `error` bodies and non-JSON 200 responses.** Rejected: for a read-only query they are not transient, and retrying would hide real errors.

## Consequences

- A full crawl of a few hundred categories now takes minutes rather than seconds. That is acceptable for a one-off manual run, and the README says so. If 429s persist at 1 s, raise `REQUEST_DELAY_MS`.
- A failed run leaves the fixtures untouched, so re-running is always safe.
- An HTTP-200 API `error` with code `ratelimited` or `maxlag` is not retried. If that shows up in practice, add it to the retryable set.
- This replaces the earlier plan's "no retries" line, which never reached an ADR. [2026-11-22-commons-images-found-by-one-category-crawl](2026-11-22-commons-images-found-by-one-category-crawl.md) does not mention retries and stays valid.
- The fixture generator keeps its own no-retry behaviour; only `find-images` gained retries.
