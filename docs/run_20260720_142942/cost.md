# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 2492 | 1916 | 4408 |
| architect-agent | 4568 | 6199 | 10767 |
| tester-agent | 7483 | 16837 | 24320 |
| test-reviewer | 24428 | 300 | 24728 |
| coder-agent | 26248 | 8780 | 35028 |
| **TOTAL** | 65219 | 34032 | 99251 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
