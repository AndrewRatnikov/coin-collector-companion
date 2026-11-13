import { ApiError } from '@/lib/api-client';

/**
 * True when a detail page's main query failed because the record doesn't exist: an API 404,
 * or a 400 from the API's `ParseUUIDPipe` for a malformed id (e.g. `/catalog/abc`).
 * Every other failure (401/403, 5xx, network, timeout) is a real error.
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 404 || error.status === 400);
}
