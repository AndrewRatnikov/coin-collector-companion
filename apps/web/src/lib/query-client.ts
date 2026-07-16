import { QueryClient } from '@tanstack/react-query';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      // apiFetch already retries once on cold-start failures (SD §6); a second layer of
      // query retries here would just stack another ~75s wait on top of that.
      queries: { retry: false },
    },
  });
}
