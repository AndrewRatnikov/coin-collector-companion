'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FormField } from '@/components/auth/form-field';
import { ApiError } from '@/lib/api-client';
import { loginUser, registerUser } from '@/lib/auth-api';
import { setStoredToken } from '@/lib/auth-token';
import { fieldErrorsFrom } from '@/lib/form-errors';

const FORM_FIELDS = ['email', 'password'];

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    setSubmitting(true);

    try {
      await registerUser(email, password);
      // POST /auth/register returns the created user, not a token (SD §4) — log in
      // immediately after so registration lands the user in the app, matching PRD §5's
      // "redirect to dashboard/set list on success".
      const { accessToken } = await loginUser(email, password);
      setStoredToken(accessToken);
      router.replace('/sets');
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setFieldErrors(fieldErrorsFrom(error.details, FORM_FIELDS));
      } else if (error instanceof ApiError && error.status === 409) {
        setFieldErrors({ email: error.message });
      } else if (error instanceof ApiError) {
        setFormError(error.message);
      } else {
        setFormError('Something went wrong. Please try again.');
      }
      setSubmitting(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-4">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-gray-200 p-6"
      >
        <h1 className="text-xl font-semibold">Create an account</h1>
        {formError && (
          <p role="alert" className="text-sm text-red-600">
            {formError}
          </p>
        )}
        <FormField
          id="email"
          label="Email"
          type="email"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
          autoComplete="email"
        />
        <FormField
          id="password"
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
          autoComplete="new-password"
        />
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
        <p className="text-sm text-gray-600">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-600 underline">
            Log in
          </Link>
        </p>
      </form>
    </main>
  );
}
