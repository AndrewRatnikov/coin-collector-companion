# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 801 | 1757 | 2558 |
| architect-agent | 4775 | 4162 | 8937 |
| tester-agent | 5446 | 8192 | 13638 |
| test-reviewer | 13870 | 300 | 14170 |
| coder-agent | 15936 | 4211 | 20147 |
| coder-agent-retry | 1814 | 200 | 2014 |
| **TOTAL** | 42642 | 18822 | 61464 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
