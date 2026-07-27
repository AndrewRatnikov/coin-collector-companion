'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/auth/form-field';
import { login } from '@/lib/auth-api';
import { ApiError } from '@/lib/api-client';
import { fieldErrorsFrom } from '@/lib/form-errors';
import { useTranslation } from '@/lib/i18n/i18n-context';

const FIELDS = ['email', 'password'];

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation();
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
        // Only a 400 (Nest's ValidationPipe) actually carries an array of class-validator's
        // per-field-prefixed messages ("email must be an email"). Every other status (401
        // wrong-credentials, 409 conflict, ...) is a single human-readable message that must
        // never be run through fieldErrorsFrom — its prefix match is calibrated for
        // class-validator's literal message shape, not prose, and would false-positive on
        // ordinary text that happens to start with a field name (e.g. a 409 "Email already
        // registered").
        if (error.status === 400) {
          setFieldErrors(fieldErrorsFrom(error.details, FIELDS));
          const unmatched = error.details.filter(
            (detail) => !FIELDS.some((field) => detail.toLowerCase().startsWith(field.toLowerCase())),
          );
          setFormError(unmatched.join(', '));
        } else {
          setFormError(error.details.join(', '));
        }
      } else {
        setFormError(t('common.somethingWentWrong'));
      }
    }
  }

  return (
    <main data-testid="login-page" className="flex flex-1 items-center justify-center p-8">
      <form data-testid="login-form" onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-lg font-semibold">{t('login.title')}</h1>
        <FormField
          id="email"
          label={t('common.email')}
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          error={fieldErrors.email}
        />
        <FormField
          id="password"
          label={t('common.password')}
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
          {t('login.submit')}
        </button>
      </form>
    </main>
  );
}
