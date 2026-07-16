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

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
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

  // A 401 only means "your session is invalid" when we actually sent a token — that's
  // the case worth clearing it and bouncing to /login for. A 401 on an unauthenticated
  // request (e.g. wrong password on /auth/login) is an ordinary business-logic error and
  // must fall through to the generic handling below so the caller/form can show it inline.
  if (response.status === 401 && token) {
    clearStoredToken();
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    throw new ApiError(401, 'Unauthorized');
  }

  if (!response.ok) {
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
