# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 1792 | 1687 | 3479 |
| architect-agent | 4297 | 4253 | 8550 |
| tester-agent | 5538 | 2591 | 8129 |
| test-reviewer | 7914 | 300 | 8214 |
| coder-agent | 9473 | 10696 | 20169 |
| **TOTAL** | 29014 | 19527 | 48541 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
