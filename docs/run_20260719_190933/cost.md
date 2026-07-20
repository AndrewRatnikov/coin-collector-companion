# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 2292 | 1373 | 3665 |
| architect-agent | 3702 | 3905 | 7607 |
| tester-agent | 5189 | 2539 | 7728 |
| test-reviewer | 7514 | 300 | 7814 |
| coder-agent | 8793 | 1843 | 10636 |
| **TOTAL** | 27490 | 9960 | 37450 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
