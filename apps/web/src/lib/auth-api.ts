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
