'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { RequireAuth } from '@/components/auth/require-auth';
import { FormField } from '@/components/auth/form-field';
import { ListSkeleton } from '@/components/ui/list-skeleton';
import { useCurrentUser } from '@/lib/hooks/use-current-user';
import { useTranslation } from '@/lib/i18n/i18n-context';
import { changePassword } from '@/lib/auth-api';
import { ApiError } from '@/lib/api-client';
import { fieldErrorsFrom } from '@/lib/form-errors';

const CHANGE_PASSWORD_FIELDS = ['currentPassword', 'newPassword'];

function ChangePasswordForm() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError('');
    setSuccessMessage('');

    if (newPassword !== confirmNewPassword) {
      setFieldErrors({
        newPassword: t('settings.passwordsDoNotMatch'),
        confirmNewPassword: t('settings.passwordsDoNotMatch'),
      });
      return;
    }

    try {
      await changePassword(currentPassword, newPassword);
      setSuccessMessage(t('settings.changePasswordSuccess'));
      setCurrentPassword('');
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (error) {
      if (error instanceof ApiError) {
        // Only a 400 (Nest's ValidationPipe) carries an array of class-validator's
        // per-field-prefixed messages — every other status (401 wrong current password, ...)
        // is a single human-readable message and must never be run through fieldErrorsFrom,
        // same reasoning login/page.tsx's handleSubmit already follows.
        if (error.status === 400) {
          setFieldErrors(fieldErrorsFrom(error.details, CHANGE_PASSWORD_FIELDS));
          const unmatched = error.details.filter(
            (detail) => !CHANGE_PASSWORD_FIELDS.some((field) => detail.toLowerCase().startsWith(field.toLowerCase())),
          );
          setFormError(unmatched.join(', '));
        } else {
          setFormError(error.details.join(', '));
        }
      } else {
        setFormError(t('settings.changePasswordError'));
      }
    }
  }

  return (
    <form
      data-testid="settings-change-password-form"
      onSubmit={handleSubmit}
      className="flex w-full max-w-[420px] flex-col gap-5 border-t border-[var(--color-divider)] pt-6"
    >
      <h2 className="text-[20px] font-normal [font-family:var(--font-heading)]">{t('settings.changePasswordTitle')}</h2>
      <FormField
        id="currentPassword"
        label={t('settings.currentPasswordLabel')}
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={setCurrentPassword}
        error={fieldErrors.currentPassword}
      />
      <FormField
        id="newPassword"
        label={t('settings.newPasswordLabel')}
        type="password"
        autoComplete="new-password"
        value={newPassword}
        onChange={setNewPassword}
        error={fieldErrors.newPassword}
      />
      <FormField
        id="confirmNewPassword"
        label={t('settings.confirmNewPasswordLabel')}
        type="password"
        autoComplete="new-password"
        value={confirmNewPassword}
        onChange={setConfirmNewPassword}
        error={fieldErrors.confirmNewPassword}
      />
      {formError && (
        <p data-testid="settings-change-password-error" className="text-sm text-red-700">
          {formError}
        </p>
      )}
      {successMessage && (
        <p data-testid="settings-change-password-success" className="text-sm text-green-700">
          {successMessage}
        </p>
      )}
      <button
        type="submit"
        data-testid="settings-change-password-submit"
        className="w-fit rounded-[2px] bg-[var(--color-accent)] px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-bg)] hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,#000)]"
      >
        {t('settings.changePasswordSubmit')}
      </button>
    </form>
  );
}

function SettingsContent() {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useCurrentUser();

  return (
    <main
      data-testid="settings-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10 text-[var(--color-text)]"
    >
      <h1 className="text-[28px] font-normal [font-family:var(--font-heading)]">{t('settings.title')}</h1>

      {isLoading && (
        <div data-testid="settings-loading">
          <ListSkeleton />
        </div>
      )}

      {isError && (
        <p data-testid="settings-error" className="text-sm text-red-700">
          {t('common.somethingWentWrong')}
        </p>
      )}

      {data && (
        <div data-testid="settings-account-info" className="flex flex-col gap-2 border-t border-[var(--color-divider)] pt-6">
          <p data-testid="settings-email" className="text-sm">
            {t('settings.emailLabel')}: {data.email}
          </p>
          <p data-testid="settings-member-since" className="text-sm text-[var(--color-neutral-600)]">
            {t('settings.memberSinceLabel')}: {new Date(data.createdAt).toLocaleDateString()}
          </p>
        </div>
      )}

      <ChangePasswordForm />
    </main>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <SettingsContent />
    </RequireAuth>
  );
}
