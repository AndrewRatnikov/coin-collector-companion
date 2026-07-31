# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 814 | 829 | 1643 |
| architect-agent | 3941 | 1823 | 5764 |
| tester-agent | 3533 | 2687 | 6220 |
| test-reviewer | 5985 | 300 | 6285 |
| coder-agent | 8047 | 261 | 8308 |
| **TOTAL** | 22320 | 5900 | 28220 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
