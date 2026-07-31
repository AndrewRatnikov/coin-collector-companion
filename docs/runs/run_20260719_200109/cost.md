# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 2492 | 1680 | 4172 |
| architect-agent | 4259 | 4317 | 8576 |
| tester-agent | 5601 | 4902 | 10503 |
| test-reviewer | 10877 | 300 | 11177 |
| coder-agent | 12405 | 2027 | 14432 |
| **TOTAL** | 35634 | 13226 | 48860 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
