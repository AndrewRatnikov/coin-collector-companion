'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { FormField } from '@/components/auth/form-field';
import { register } from '@/lib/auth-api';
import { ApiError } from '@/lib/api-client';
import { fieldErrorsFrom } from '@/lib/form-errors';
import { useTranslation } from '@/lib/i18n/i18n-context';

const FIELDS = ['email', 'password'];

export default function SignupPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');

    if (password !== confirmPassword) {
      setFieldErrors({
        password: t('signup.passwordsDoNotMatch'),
        confirmPassword: t('signup.passwordsDoNotMatch'),
      });
      return;
    }

    try {
      await register({ email, password });
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
    <main
      data-testid="signup-page"
      className="mx-auto flex w-full max-w-[420px] flex-1 flex-col items-stretch justify-center gap-8 px-6 py-16 text-[var(--color-text)]"
    >
      <div className="flex flex-col items-center gap-4 border-b border-[var(--color-divider)] pb-6">
        <span className="text-[22px] font-semibold [font-family:var(--font-heading)]">{t('nav.brand')}</span>
      </div>

      <form data-testid="signup-form" onSubmit={handleSubmit} className="flex w-full flex-col gap-5">
        <h1 className="text-[24px] font-normal [font-family:var(--font-heading)]">{t('signup.title')}</h1>
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
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          error={fieldErrors.password}
        />
        <FormField
          id="confirmPassword"
          label={t('signup.confirmPasswordLabel')}
          type="password"
          autoComplete="new-password"
          value={confirmPassword}
          onChange={setConfirmPassword}
          error={fieldErrors.confirmPassword}
        />
        {formError && (
          <p data-testid="signup-form-error" className="text-sm text-red-700">
            {formError}
          </p>
        )}
        <button
          type="submit"
          data-testid="signup-submit"
          className="w-full rounded-[2px] bg-[var(--color-accent)] px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-bg)] hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,#000)]"
        >
          {t('signup.submit')}
        </button>
      </form>
    </main>
  );
}
