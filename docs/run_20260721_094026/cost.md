# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 867 | 1491 | 2358 |
| architect-agent | 4423 | 4454 | 8877 |
| tester-agent | 6027 | 5237 | 11264 |
| test-reviewer | 11018 | 300 | 11318 |
| coder-agent | 12900 | 2693 | 15593 |
| **TOTAL** | 35235 | 14175 | 49410 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
