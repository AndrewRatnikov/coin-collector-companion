# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 800 | 1700 | 2500 |
| architect-agent | 5210 | 5043 | 10253 |
| tester-agent | 6327 | 11095 | 17422 |
| test-reviewer | 17683 | 300 | 17983 |
| coder-agent | 20063 | 5680 | 25743 |
| sandbox | 500 | 200 | 700 |
| **TOTAL** | 50583 | 24018 | 74601 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
