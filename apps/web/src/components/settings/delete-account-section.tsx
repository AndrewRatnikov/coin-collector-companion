'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { markAccountDeleted } from '@/lib/account-deleted-notice';
import { ApiError } from '@/lib/api-client';
import { deleteAccount } from '@/lib/auth-api';
import { clearStoredToken } from '@/lib/auth-token';
import { useTranslation } from '@/lib/i18n/i18n-context';

export function DeleteAccountSection() {
  const { t } = useTranslation();
  const router = useRouter();
  const queryClient = useQueryClient();

  const [isConfirming, setIsConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const canSubmit = acknowledged && password.length > 0 && !isSubmitting;

  function resetStep() {
    setIsConfirming(false);
    setPassword('');
    setAcknowledged(false);
    setFormError('');
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      return;
    }

    setFormError('');
    setIsSubmitting(true);

    try {
      await deleteAccount(password);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        setFormError(t('settings.deleteAccountWrongPassword'));
      } else {
        setFormError(t('settings.deleteAccountError'));
      }
      setIsSubmitting(false);
      return;
    }

    // Success: the component is navigating away, so isSubmitting stays true.
    clearStoredToken();
    queryClient.clear();
    markAccountDeleted();
    router.replace('/');
  }

  return (
    <section
      data-testid="settings-delete-account"
      className="flex w-full max-w-[420px] flex-col gap-4 border-t border-[var(--color-divider)] pt-6"
    >
      <h2 className="text-[20px] font-normal text-red-700 [font-family:var(--font-heading)]">
        {t('settings.deleteAccountTitle')}
      </h2>
      <p className="text-sm text-[var(--color-neutral-600)]">{t('settings.deleteAccountIntro')}</p>

      {!isConfirming && (
        <button
          type="button"
          data-testid="settings-delete-account-open"
          onClick={() => setIsConfirming(true)}
          className="w-fit rounded-[2px] border border-red-600 px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[0.1em] text-red-700 hover:bg-red-50"
        >
          {t('settings.deleteAccountOpen')}
        </button>
      )}

      {isConfirming && (
        <form
          data-testid="settings-delete-account-confirm-step"
          onSubmit={handleSubmit}
          className="flex flex-col gap-4 rounded-[var(--radius-sm)] border border-red-600 p-4"
        >
          <div data-testid="settings-delete-account-explanation" className="flex flex-col gap-2 text-sm">
            <p>{t('settings.deleteAccountWhatIsDeleted')}</p>
            <p>{t('settings.deleteAccountWhatStays')}</p>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="deleteAccountPassword" className="text-sm font-medium text-[var(--color-text)]">
              {t('settings.deleteAccountPasswordLabel')}
            </label>
            <input
              id="deleteAccountPassword"
              type="password"
              autoComplete="current-password"
              data-testid="settings-delete-account-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-[var(--radius-sm)] border border-[var(--color-divider)] bg-transparent px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-200)]"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="deleteAccountAcknowledge"
              type="checkbox"
              data-testid="settings-delete-account-acknowledge"
              checked={acknowledged}
              onChange={(e) => setAcknowledged(e.target.checked)}
            />
            <label htmlFor="deleteAccountAcknowledge" className="text-sm text-[var(--color-text)]">
              {t('settings.deleteAccountAcknowledge')}
            </label>
          </div>

          {formError && (
            <p data-testid="settings-delete-account-error" role="alert" className="text-sm text-red-700">
              {formError}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              data-testid="settings-delete-account-submit"
              disabled={!canSubmit}
              className="w-fit rounded-[2px] bg-red-700 px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[0.1em] text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {t('settings.deleteAccountSubmit')}
            </button>
            <button
              type="button"
              data-testid="settings-delete-account-cancel"
              onClick={resetStep}
              className="w-fit rounded-[2px] border border-[var(--color-divider)] px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-text)]"
            >
              {t('settings.deleteAccountCancel')}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
