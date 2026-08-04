# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 805 | 1738 | 2543 |
| architect-agent | 5618 | 5897 | 11515 |
| tester-agent | 7480 | 18488 | 25968 |
| test-reviewer | 25754 | 300 | 26054 |
| coder-agent | 28583 | 8381 | 36964 |
| **TOTAL** | 68240 | 34804 | 103044 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
