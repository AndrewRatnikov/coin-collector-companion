# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 2609 | 1883 | 4492 |
| architect-agent | 4350 | 4920 | 9270 |
| tester-agent | 6281 | 11112 | 17393 |
| test-reviewer | 17179 | 300 | 17479 |
| coder-agent | 18596 | 2921 | 21517 |
| **TOTAL** | 49015 | 21136 | 70151 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
