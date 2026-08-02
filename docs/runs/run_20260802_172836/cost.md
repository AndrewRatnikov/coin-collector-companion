# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 805 | 1047 | 1852 |
| architect-agent | 4110 | 3588 | 7698 |
| tester-agent | 4872 | 7195 | 12067 |
| test-reviewer | 11982 | 300 | 12282 |
| coder-agent | 13995 | 8925 | 22920 |
| **TOTAL** | 35764 | 21055 | 56819 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
