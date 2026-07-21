'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/auth/form-field';
import { login } from '@/lib/auth-api';
import { ApiError } from '@/lib/api-client';
import { fieldErrorsFrom } from '@/lib/form-errors';

const FIELDS = ['email', 'password'];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');

    try {
      await login({ email, password });
      router.push('/dashboard');
    } catch (error) {
      if (error instanceof ApiError) {
        setFieldErrors(fieldErrorsFrom(error.details, FIELDS));
        const unmatched = error.details.filter(
          (detail) => !FIELDS.some((field) => detail.toLowerCase().startsWith(field.toLowerCase())),
        );
        setFormError(unmatched.join(', '));
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    }
  }

  return (
    <main data-testid="login-page" className="flex flex-1 items-center justify-center p-8">
      <form data-testid="login-form" onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-lg font-semibold">Log in</h1>
        <FormField
          id="email"
          label="Email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
        />
        {formError && (
          <p data-testid="login-form-error" className="text-sm text-red-600">
            {formError}
          </p>
        )}
        <button
          type="submit"
          data-testid="login-submit"
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white"
        >
          Log in
        </button>
      </form>
    </main>
  );
}
