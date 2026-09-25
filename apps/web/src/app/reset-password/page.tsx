'use client';

import { Suspense, useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormField } from '@/components/auth/form-field';
import { resetPassword } from '@/lib/auth-api';
import { ApiError } from '@/lib/api-client';
import { fieldErrorsFrom } from '@/lib/form-errors';
import { useTranslation } from '@/lib/i18n/i18n-context';

const PAGE_CLASSES =
  'mx-auto flex w-full max-w-[420px] flex-1 flex-col items-stretch justify-center gap-8 px-6 py-16 text-[var(--color-text)]';

// backlog_password-management.md Step 3, task 3.8. Reads the token from the emailed link
// (?token=...). On success the API has already logged out every session, so the user is
// sent to /login with a flag that shows a "password was reset" notice.
function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { t } = useTranslation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [linkInvalid, setLinkInvalid] = useState(!token);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');

    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: t('resetPassword.passwordsDoNotMatch') });
      return;
    }

    setSubmitting(true);
    try {
      await resetPassword(token, newPassword);
      router.push('/login?reset=success');
    } catch (error) {
      if (error instanceof ApiError && error.status === 400) {
        // A 400 is either a validation message about newPassword (e.g. too short) or the
        // service's "invalid or expired reset link" rejection.
        const errors = fieldErrorsFrom(error.details, ['newPassword']);
        if (errors.newPassword) {
          setFieldErrors(errors);
        } else {
          setLinkInvalid(true);
        }
      } else if (error instanceof ApiError && error.status === 429) {
        setFormError(t('forgotPassword.tooManyRequests'));
      } else {
        setFormError(t('common.somethingWentWrong'));
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (linkInvalid) {
    return (
      <div data-testid="reset-password-invalid" className="flex flex-col gap-4">
        <p role="alert" className="text-sm text-red-700">
          {t('resetPassword.invalidLink')}
        </p>
        <Link href="/forgot-password" data-testid="reset-password-request-new-link" className="text-sm underline">
          {t('resetPassword.requestNewLink')}
        </Link>
      </div>
    );
  }

  return (
    <form data-testid="reset-password-form" onSubmit={handleSubmit} className="flex flex-col gap-5">
      <FormField
        id="newPassword"
        label={t('resetPassword.newPasswordLabel')}
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={setNewPassword}
        error={fieldErrors.newPassword}
      />
      <FormField
        id="confirmPassword"
        label={t('resetPassword.confirmPasswordLabel')}
        type="password"
        autoComplete="new-password"
        value={confirmPassword}
        onChange={setConfirmPassword}
        error={fieldErrors.confirmPassword}
      />
      {formError && (
        <p data-testid="reset-password-form-error" className="text-sm text-red-700">
          {formError}
        </p>
      )}
      <button
        type="submit"
        data-testid="reset-password-submit"
        disabled={submitting}
        className="w-full rounded-[2px] bg-[var(--color-accent)] px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-bg)] hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,#000)] disabled:opacity-60"
      >
        {t('resetPassword.submit')}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();

  return (
    <main data-testid="reset-password-page" className={PAGE_CLASSES}>
      <div className="flex flex-col items-center gap-4 border-b border-[var(--color-divider)] pb-6">
        <span className="text-[22px] font-semibold [font-family:var(--font-heading)]">{t('nav.brand')}</span>
      </div>
      <div className="flex w-full flex-col gap-5">
        <h1 className="text-[24px] font-normal [font-family:var(--font-heading)]">{t('resetPassword.title')}</h1>
        {/* useSearchParams() needs a Suspense boundary for Next's static prerender. */}
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
