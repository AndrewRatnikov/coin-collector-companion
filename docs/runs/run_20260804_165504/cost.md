# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 848 | 918 | 1766 |
| architect-agent | 5424 | 5769 | 11193 |
| tester-agent | 7096 | 9787 | 16883 |
| test-reviewer | 16669 | 300 | 16969 |
| coder-agent | 20135 | 12905 | 33040 |
| **TOTAL** | 50172 | 29679 | 79851 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
