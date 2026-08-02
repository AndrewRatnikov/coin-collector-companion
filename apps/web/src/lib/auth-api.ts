import { apiFetch } from './api-client';
import { clearStoredToken, setStoredToken } from './auth-token';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
}

export interface CurrentUser {
  id: string;
  email: string;
  createdAt: string;
}

export async function login(credentials: LoginCredentials): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  setStoredToken(response.accessToken);
  return response;
}

export async function register(credentials: RegisterCredentials): Promise<AuthResponse> {
  // POST /auth/register only creates the account (returns { id, email, createdAt }, no
  // token) — login and register are separate endpoints by backend design. Chain into
  // login() with the same credentials so signing up actually authenticates the user.
  await apiFetch<{ id: string; email: string; createdAt: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
  return login(credentials);
}

export async function getCurrentUser(): Promise<CurrentUser> {
  return apiFetch<CurrentUser>('/auth/me');
}

// PATCH /auth/password (backlog_password-management.md Step 1, task 1.3). Opts out of
// apiFetch's default 401-clears-session behavior — a wrong current password is a normal,
// still-authenticated rejection, not a signal that the session itself is invalid.
export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiFetch<void>(
    '/auth/password',
    { method: 'PATCH', body: JSON.stringify({ currentPassword, newPassword }) },
    { skipAuthRedirectOn401: true },
  );
}

// POST /auth/refresh (backlog_password-management.md Step 2, task 2.11). A pure
// request/response call with no redirect side effect of its own (skipAuthRedirectOn401) —
// the redirect-on-failure behavior lives entirely in apiFetch's own internal silent-refresh
// path, not here.
export async function refreshAccessToken(): Promise<AuthResponse> {
  const response = await apiFetch<AuthResponse>(
    '/auth/refresh',
    { method: 'POST' },
    { skipAuthRedirectOn401: true },
  );
  setStoredToken(response.accessToken);
  return response;
}

// POST /auth/logout (backlog_password-management.md Step 2, task 2.11). Awaited, not
// fire-and-forget, so the server-side revocation actually completes before local state
// clears.
export async function logout(): Promise<void> {
  await apiFetch<void>('/auth/logout', { method: 'POST' }, { skipAuthRedirectOn401: true });
  clearStoredToken();
}
