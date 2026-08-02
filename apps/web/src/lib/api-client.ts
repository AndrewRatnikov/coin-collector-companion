import { clearStoredToken, getStoredToken } from './auth-token';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;
const REQUEST_TIMEOUT_MS = 75_000; // Render cold start is ~30-60s (SD §6)

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
    return await fetch(url, { ...init, signal: controller.signal });
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
    if (token && response.status === 401 && !options.skipAuthRedirectOn401) {
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
