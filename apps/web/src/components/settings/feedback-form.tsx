'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { ApiError } from '@/lib/api-client';
import { useSubmitFeedback } from '@/lib/hooks/use-feedback';
import { useTranslation } from '@/lib/i18n/i18n-context';

const MAX_FEEDBACK_LENGTH = 2000;

export function FeedbackForm() {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [validationError, setValidationError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const submitFeedbackMutation = useSubmitFeedback();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError('');
    setFormError('');
    setSuccessMessage('');

    const trimmed = text.trim();
    if (!trimmed) {
      setValidationError(t('settings.feedbackValidationEmpty'));
      return;
    }
    if (trimmed.length > MAX_FEEDBACK_LENGTH) {
      setValidationError(t('settings.feedbackValidationTooLong'));
      return;
    }

    submitFeedbackMutation.mutate(
      { text: trimmed },
      {
        onSuccess: () => {
          setSuccessMessage(t('settings.feedbackSuccess'));
          setText('');
        },
        onError: (error: unknown) => {
          if (error instanceof ApiError) {
            setFormError(error.details.join(', '));
          } else {
            setFormError(t('settings.feedbackError'));
          }
        },
      },
    );
  }

  return (
    <form
      data-testid="settings-feedback-form"
      onSubmit={handleSubmit}
      className="flex w-full max-w-[420px] flex-col gap-5 border-t border-[var(--color-divider)] pt-6"
    >
      <h2 className="text-[20px] font-normal [font-family:var(--font-heading)]">{t('settings.feedbackTitle')}</h2>
      <div className="flex flex-col gap-1">
        <label htmlFor="feedback-text" className="text-sm font-medium text-[var(--color-text)]">
          {t('settings.feedbackTextLabel')}
        </label>
        <textarea
          id="feedback-text"
          name="feedback-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={6}
          aria-invalid={validationError ? true : undefined}
          aria-describedby={validationError ? 'feedback-text-error' : undefined}
          className={`rounded-[var(--radius-sm)] border bg-transparent px-3 py-2 text-sm text-[var(--color-text)] focus:outline-none focus:ring-2 ${
            validationError
              ? 'border-red-500 focus:ring-red-200'
              : 'border-[var(--color-divider)] focus:ring-[var(--color-accent-200)]'
          }`}
        />
        {validationError && (
          <p id="feedback-text-error" className="text-sm text-red-600">
            {validationError}
          </p>
        )}
      </div>
      {formError && (
        <p data-testid="settings-feedback-error" className="text-sm text-red-700">
          {formError}
        </p>
      )}
      {successMessage && (
        <p data-testid="settings-feedback-success" className="text-sm text-green-700">
          {successMessage}
        </p>
      )}
      <button
        type="submit"
        data-testid="settings-feedback-submit"
        className="w-fit rounded-[2px] bg-[var(--color-accent)] px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-bg)] hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,#000)]"
      >
        {t('settings.feedbackSubmit')}
      </button>
    </form>
  );
}
