# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 826 | 989 | 1815 |
| architect-agent | 4387 | 5219 | 9606 |
| tester-agent | 6503 | 4024 | 10527 |
| test-reviewer | 10579 | 300 | 10879 |
| coder-agent | 12927 | 24622 | 37549 |
| **TOTAL** | 35222 | 35154 | 70376 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
