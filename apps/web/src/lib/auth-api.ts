import { apiFetch } from './api-client';

// Mirrors apps/api's RegisteredUser/LoginResponse (not in packages/shared's contracts.ts —
// those cover only the non-obvious payload shapes per SD §4).
export interface RegisteredUser {
  id: string;
  email: string;
  createdAt: string;
}

export interface LoginResponse {
  accessToken: string;
}

export function registerUser(email: string, password: string): Promise<RegisteredUser> {
  return apiFetch<RegisteredUser>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function loginUser(email: string, password: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
