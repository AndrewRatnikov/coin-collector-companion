# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 2829 | 1530 | 4359 |
| architect-agent | 4180 | 3280 | 7460 |
| tester-agent | 4564 | 8095 | 12659 |
| test-reviewer | 12445 | 300 | 12745 |
| coder-agent | 14044 | 5646 | 19690 |
| **TOTAL** | 38062 | 18851 | 56913 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
