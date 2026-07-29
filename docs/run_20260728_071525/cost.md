# Token Usage Summary (heuristic estimate — see note below)

| Stage | Input tok (est) | Output tok (est) | Stage total tok (est) |
|-------|------------------|-------------------|------------------------|
| product-agent | 7346 | 1708 | 9054 |
| design-extraction | 4000 | 1400 | 5400 |
| codebase-survey | 8262 | 11117 | 19379 |
| architect-agent | 22098 | 7791 | 29889 |
| tester-agent | 7791 | 38707 | 46498 |
| tester-agent | 9075 | 38707 | 47782 |
| test-reviewer | 45000 | 300 | 45300 |
| tester-fix-retry1 | 8000 | 3500 | 11500 |
| test-reviewer-recheck | 13000 | 300 | 13300 |
| coder-agent | 54062 | 30254 | 84316 |
| coder-fix-retry1 | 54163 | 1200 | 55363 |
| **TOTAL** | 232797 | 134984 | 367781 |

> Estimated from artifact file sizes (chars/4). Excludes conversation
> context, agent reasoning, and retries — real usage is substantially
> higher. Use for RELATIVE stage comparison only, never as an exact count.
