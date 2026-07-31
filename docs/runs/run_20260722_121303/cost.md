# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 801 | 1433 | 2234 |
| architect-agent | 4834 | 3291 | 8125 |
| tester-agent | 4576 | 12531 | 17107 |
| test-reviewer | 17460 | 300 | 17760 |
| coder-agent | 19810 | 5756 | 25566 |
| **TOTAL** | 47481 | 23311 | 70792 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
