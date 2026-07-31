# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 842 | 1268 | 2110 |
| architect-agent | 5466 | 4813 | 10279 |
| tester-agent | 6598 | 17195 | 23793 |
| test-reviewer | 23642 | 300 | 23942 |
| coder-agent | 26790 | 8123 | 34913 |
| **TOTAL** | 63338 | 31699 | 95037 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
