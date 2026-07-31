# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 801 | 1825 | 2626 |
| architect-agent | 5163 | 5534 | 10697 |
| tester-agent | 6818 | 10935 | 17753 |
| test-reviewer | 17539 | 300 | 17839 |
| coder-agent | 19826 | 4312 | 24138 |
| **TOTAL** | 50147 | 22906 | 73053 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
