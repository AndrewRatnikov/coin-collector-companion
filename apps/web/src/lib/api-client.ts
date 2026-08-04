import { clearStoredToken, getStoredToken, setStoredToken } from './auth-token';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const REQUEST_TIMEOUT_MS = 75_000; // Render cold start is ~30-60s (SD §6)
const REFRESH_PATH = '/auth/refresh';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    // Nest's ValidationPipe sends `message` as an array of per-field strings (e.g.
    // "email must be an email"); `message` above is the joined display string, `details`
    // keeps the raw entries so callers can map them back to individual form fields.
    public readonly details: string[] = [message],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiFetchOptions {
  // Set when a 401 from this specific call means something other than "the session itself
  // is invalid" (e.g. PATCH /auth/password's "wrong current password" response, which is
  // still a fully authenticated request) — skips the default clear-token-and-redirect
  // behavior below so the caller can show an inline error instead of losing the session.
  skipAuthRedirectOn401?: boolean;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    // credentials: 'include' on every call so the browser sends/receives the httpOnly
    // refresh-token cookie (backlog_password-management.md Step 2) — web and API are on
    // different origins, so this is required for the cookie to travel at all.
    return await fetch(url, { ...init, signal: controller.signal, credentials: 'include' });
  } finally {
    clearTimeout(timer);
  }
}

// A timed-out or connection-refused fetch (AbortError / TypeError) means the request
// never reached the API — the signature of Render waking up from idle, not an app-level
// failure. Retrying those once is safe; HTTP error responses are never retried here since
// the server already processed the request (SD §6 — one retry, no keep-warm).
function isColdStartFailure(error: unknown): boolean {
  return (error instanceof DOMException && error.name === 'AbortError') || error instanceof TypeError;
}

// One-shot silent refresh: POST /auth/refresh directly via fetchWithTimeout (not through
// auth-api.ts's refreshAccessToken(), to avoid a circular import between the two modules).
// Returns the new access token on success, or null on any failure — never throws.
async function attemptSilentRefresh(): Promise<string | null> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}${REFRESH_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { accessToken: string };
    setStoredToken(body.accessToken);
    return body.accessToken;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}, options: ApiFetchOptions = {}): Promise<T> {
  if (!API_BASE_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not set');
  }

  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');

  const token = getStoredToken();
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const url = `${API_BASE_URL}${path}`;
  const requestInit: RequestInit = { ...init, headers };

  let response: Response;
  try {
    response = await fetchWithTimeout(url, requestInit);
  } catch (error) {
    if (!isColdStartFailure(error)) throw error;
    response = await fetchWithTimeout(url, requestInit);
  }

  if (!response.ok) {
    // A 401 on a request that actually carried a token means the session itself was
    // rejected (expired/invalid JWT) — clear it and bounce to /login. A 401 with no
    // token attached (e.g. /auth/login's own wrong-password response) is a normal
    // anonymous-request failure, not a session invalidation, so it's left for the
    // caller (the login/signup form) to handle inline. `skipAuthRedirectOn401` opts a
    // specific authenticated call out of this entirely, for the same reason — its 401
    // doesn't mean the session is invalid either (see ApiFetchOptions above).
    const sessionInvalid = Boolean(token) && response.status === 401 && !options.skipAuthRedirectOn401;
    const isRefreshCall = path === REFRESH_PATH;

    // Before falling back to clear-and-redirect, try exactly one silent refresh-and-retry
    // (backlog_password-management.md Step 2, task 2.10) — never attempted for /auth/refresh's
    // own 401, which is what stops any recursive refresh loop.
    if (sessionInvalid && !isRefreshCall) {
      const refreshedToken = await attemptSilentRefresh();
      if (refreshedToken) {
        const retryHeaders = new Headers(init.headers);
        retryHeaders.set('Content-Type', 'application/json');
        retryHeaders.set('Authorization', `Bearer ${refreshedToken}`);
        response = await fetchWithTimeout(url, { ...init, headers: retryHeaders });

        if (response.ok) {
          if (response.status === 204) {
            return undefined as T;
          }
          return (await response.json()) as T;
        }
        // Retry also failed — fall through below using this (retried) response's details.
      }
    }

    if (sessionInvalid) {
      clearStoredToken();
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }

    const body: unknown = await response.json().catch(() => null);
    const message =
      body && typeof body === 'object' && 'message' in body
        ? (body as { message: unknown }).message
        : response.statusText;
    const details = Array.isArray(message) ? message.map(String) : [String(message)];
    throw new ApiError(response.status, details.join(', '), details);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
