import { apiFetch } from './api-client';
import { setStoredToken } from './auth-token';

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
