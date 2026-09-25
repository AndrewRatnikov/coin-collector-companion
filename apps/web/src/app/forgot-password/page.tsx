'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { FormField } from '@/components/auth/form-field';
import { forgotPassword } from '@/lib/auth-api';
import { ApiError } from '@/lib/api-client';
import { fieldErrorsFrom } from '@/lib/form-errors';
import { useTranslation } from '@/lib/i18n/i18n-context';

// backlog_password-management.md Step 3, task 3.7. Any successful response shows the same
// message: the API never says whether the email is registered, and neither does this page.
export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [formError, setFormError] = useState('');
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError('');
    setFormError('');
    setSubmitting(true);

    try {
      await forgotPassword(email);
      setSent(true);
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        setEmailError(fieldErrorsFrom(error.details, ['email']).email ?? error.details.join(', '));
      } else if (error instanceof ApiError && error.status === 429) {
        setFormError(t('forgotPassword.tooManyRequests'));
      } else {
        setFormError(t('common.somethingWentWrong'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main
      data-testid="forgot-password-page"
      className="mx-auto flex w-full max-w-[420px] flex-1 flex-col items-stretch justify-center gap-8 px-6 py-16 text-[var(--color-text)]"
    >
      <div className="flex flex-col items-center gap-4 border-b border-[var(--color-divider)] pb-6">
        <span className="text-[22px] font-semibold [font-family:var(--font-heading)]">{t('nav.brand')}</span>
      </div>

      <div className="flex w-full flex-col gap-5">
        <h1 className="text-[24px] font-normal [font-family:var(--font-heading)]">{t('forgotPassword.title')}</h1>

        {sent ? (
          <p data-testid="forgot-password-sent" role="status" className="text-sm">
            {t('forgotPassword.sent')}
          </p>
        ) : (
          <form data-testid="forgot-password-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
            <p className="text-sm text-[var(--color-neutral-600)]">{t('forgotPassword.intro')}</p>
            <FormField
              id="email"
              label={t('common.email')}
              type="email"
              autoComplete="email"
              value={email}
              onChange={setEmail}
              error={emailError}
            />
            {formError && (
              <p data-testid="forgot-password-form-error" className="text-sm text-red-700">
                {formError}
              </p>
            )}
            <button
              type="submit"
              data-testid="forgot-password-submit"
              disabled={submitting}
              className="w-full rounded-[2px] bg-[var(--color-accent)] px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-bg)] hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,#000)] disabled:opacity-60"
            >
              {t('forgotPassword.submit')}
            </button>
          </form>
        )}

        <Link href="/login" data-testid="forgot-password-back-link" className="text-sm underline">
          {t('forgotPassword.backToLogin')}
        </Link>
      </div>
    </main>
  );
}
