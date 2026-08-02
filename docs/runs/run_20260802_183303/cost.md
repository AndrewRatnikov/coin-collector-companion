# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 807 | 1265 | 2072 |
| architect-agent | 5194 | 5031 | 10225 |
| tester-agent | 6315 | 8331 | 14646 |
| test-reviewer | 14432 | 300 | 14732 |
| coder-agent | 17259 | 10640 | 27899 |
| **TOTAL** | 44007 | 25567 | 69574 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
