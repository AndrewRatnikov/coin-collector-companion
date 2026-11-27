import 'server-only';

/**
 * The one way server components and metadata routes read the API (ADR
 * 2026-11-26-public-pages-server-rendered-with-cached-api-data). Responses go through Next's data
 * cache with a revalidate interval, and every request is aborted after SERVER_FETCH_TIMEOUT_MS so
 * a sleeping Render API can't hang a crawler. Anonymous only: no token, cookie or credentials.
 */

/** Lists (catalog pages, checklists, public sets) change at most a few times a day. */
export const LIST_REVALIDATE_SECONDS = 3600;
/** A coin's specs rarely change once approved. */
export const COIN_REVALIDATE_SECONDS = 86400;
export const SERVER_FETCH_TIMEOUT_MS = 5000;

export type ServerApiErrorKind = 'config' | 'timeout' | 'network' | 'http';

export class ServerApiError extends Error {
  readonly kind: ServerApiErrorKind;
  readonly status: number | null;

  constructor(kind: ServerApiErrorKind, status: number | null, message: string) {
    super(message);
    this.name = 'ServerApiError';
    this.kind = kind;
    this.status = status;
  }
}

/** API_URL (server-only) or NEXT_PUBLIC_API_URL, read per call, trimmed, no trailing slash. */
export function serverApiBaseUrl(): string {
  const raw = process.env.API_URL?.trim() || process.env.NEXT_PUBLIC_API_URL?.trim();
  if (!raw) {
    throw new ServerApiError('config', null, 'API_URL / NEXT_PUBLIC_API_URL is not set');
  }
  return raw.replace(/\/+$/, '');
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    ((error as { name: unknown }).name === 'AbortError' ||
      (error as { name: unknown }).name === 'TimeoutError')
  );
}

export async function serverApiGet<T>(
  path: string,
  options: { revalidate: number } = { revalidate: LIST_REVALIDATE_SECONDS },
): Promise<T> {
  const url = `${serverApiBaseUrl()}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SERVER_FETCH_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: options.revalidate },
      signal: controller.signal,
    });
  } catch (error) {
    if (controller.signal.aborted || isAbortError(error)) {
      throw new ServerApiError(
        'timeout',
        null,
        `GET ${path} timed out after ${SERVER_FETCH_TIMEOUT_MS} ms`,
      );
    }
    throw new ServerApiError('network', null, `GET ${path} failed: ${String(error)}`);
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    throw new ServerApiError('http', res.status, `GET ${path} returned ${res.status}`);
  }
  return (await res.json()) as T;
}
