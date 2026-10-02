'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { formatCoinLabel } from '@coin-collector/shared';
import type { AdminCoinListItem, ReviewCoinRequest } from '@coin-collector/shared';
import { ApiError } from '@/lib/api-client';
import { useReviewCoin } from '@/lib/hooks/use-admin';
import { useTranslation } from '@/lib/i18n/i18n-context';

export interface SubmissionReviewItemProps {
  coin: AdminCoinListItem;
}

type Mode = 'idle' | 'reject' | 'edit';

// Mirrors the API's REJECTION_REASON_MAX_LENGTH (ReviewCoinDto).
const REJECTION_REASON_MAX_LENGTH = 500;

const primaryButtonClassName =
  'rounded-[2px] bg-[var(--color-accent)] px-4 py-2 text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-bg)] hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,#000)] disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButtonClassName =
  'rounded-[2px] border border-[var(--color-divider)] px-4 py-2 text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-text)] hover:border-[var(--color-accent)] disabled:cursor-not-allowed disabled:opacity-50';
const labelClassName = 'text-[11px] uppercase tracking-[0.14em] text-[var(--color-neutral-600)]';
const inputClassName =
  'rounded-[var(--radius-sm)] border border-[var(--color-divider)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-200)]';

export function SubmissionReviewItem({ coin }: SubmissionReviewItemProps) {
  const { t } = useTranslation();
  const review = useReviewCoin();
  const [mode, setMode] = useState<Mode>('idle');
  const isPending = review.isPending;

  function submit(body: ReviewCoinRequest) {
    review.mutate(
      { id: coin.id, body },
      {
        onSuccess: () => setMode('idle'),
      },
    );
  }

  function errorMessage(error: unknown): string {
    if (error instanceof ApiError) {
      // Only the ValidationPipe's 400 carries per-field messages worth showing verbatim.
      if (error.status === 400) return error.details.join(', ');
      if (error.status === 409) return t('admin.errorConflict');
      if (error.status === 403) return t('admin.forbidden');
    }
    return t('common.somethingWentWrong');
  }

  return (
    <li
      data-testid="admin-submission-item"
      className="flex flex-col gap-3 border-b border-[var(--color-divider)] px-1 py-4"
    >
      <div className="flex flex-col gap-1">
        <p data-testid="admin-submission-label" className="text-sm text-[var(--color-text)]">
          <span className="font-medium">{formatCoinLabel(coin)}</span> <span>{coin.name}</span>
        </p>
        <p data-testid="admin-submission-submitter" className="text-xs text-[var(--color-neutral-600)]">
          {coin.submitterEmail ? `${t('admin.submittedBy')} ${coin.submitterEmail}` : t('admin.submitterUnknown')}
        </p>
        {coin.possibleDuplicate !== null && (
          <p
            data-testid="admin-submission-duplicate-warning"
            className="text-xs text-[color:var(--color-accent-800)]"
          >
            {t('admin.duplicateWarning')}{' '}
            <Link
              href={`/catalog/${coin.possibleDuplicate.id}`}
              data-testid="admin-submission-duplicate-link"
              className="underline hover:text-[var(--color-accent)]"
            >
              {coin.possibleDuplicate.name}
            </Link>
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          data-testid="admin-submission-approve"
          className={primaryButtonClassName}
          disabled={isPending}
          onClick={() => submit({ status: 'approved' })}
        >
          {t('admin.approve')}
        </button>
        <button
          type="button"
          data-testid="admin-submission-reject"
          className={secondaryButtonClassName}
          disabled={isPending}
          onClick={() => setMode('reject')}
        >
          {t('admin.reject')}
        </button>
        <button
          type="button"
          data-testid="admin-submission-edit"
          className={secondaryButtonClassName}
          disabled={isPending}
          onClick={() => setMode('edit')}
        >
          {t('admin.edit')}
        </button>
      </div>

      {mode === 'reject' && (
        <RejectForm isPending={isPending} onCancel={() => setMode('idle')} onSubmit={submit} />
      )}

      {mode === 'edit' && (
        <EditForm coin={coin} isPending={isPending} onCancel={() => setMode('idle')} onSubmit={submit} />
      )}

      {review.isError && (
        <p data-testid="admin-submission-error" role="alert" className="text-sm text-[color:var(--color-accent-800)]">
          {errorMessage(review.error)}
        </p>
      )}
    </li>
  );
}

interface FormProps {
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (body: ReviewCoinRequest) => void;
}

function RejectForm({ isPending, onCancel, onSubmit }: FormProps) {
  const { t } = useTranslation();
  const reasonId = useId();
  const [reason, setReason] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = reason.trim();
    onSubmit(trimmed ? { status: 'rejected', rejectionReason: trimmed } : { status: 'rejected' });
  }

  return (
    <form data-testid="admin-submission-reject-form" className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <label htmlFor={reasonId} className={labelClassName}>
        {t('admin.rejectReasonLabel')}
      </label>
      <textarea
        id={reasonId}
        data-testid="admin-submission-reject-reason"
        className={inputClassName}
        maxLength={REJECTION_REASON_MAX_LENGTH}
        rows={3}
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          data-testid="admin-submission-reject-confirm"
          className={primaryButtonClassName}
          disabled={isPending}
        >
          {t('admin.rejectConfirm')}
        </button>
        <button
          type="button"
          data-testid="admin-submission-reject-cancel"
          className={secondaryButtonClassName}
          onClick={onCancel}
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}

function EditForm({ coin, isPending, onCancel, onSubmit }: FormProps & { coin: AdminCoinListItem }) {
  const { t } = useTranslation();
  const idPrefix = useId();
  // Initialised once when the form mounts (not synced with an effect), so the first paint
  // already shows the coin's values.
  const [country, setCountry] = useState(() => coin.country);
  const [denomination, setDenomination] = useState(() => coin.denomination);
  const [name, setName] = useState(() => coin.name);
  const [year, setYear] = useState(() => String(coin.year));
  const [mintMark, setMintMark] = useState(() => coin.mintMark);
  const [variety, setVariety] = useState(() => coin.variety);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit({ status: 'approved', country, denomination, name, year: Number(year), mintMark, variety });
  }

  return (
    <form data-testid="admin-submission-edit-form" className="flex flex-col gap-3" onSubmit={handleSubmit}>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-country`} className={labelClassName}>
            {t('common.country')}
          </label>
          <input
            id={`${idPrefix}-country`}
            data-testid="admin-submission-edit-country"
            type="text"
            className={inputClassName}
            value={country}
            onChange={(event) => setCountry(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-denomination`} className={labelClassName}>
            {t('common.denomination')}
          </label>
          <input
            id={`${idPrefix}-denomination`}
            data-testid="admin-submission-edit-denomination"
            type="text"
            className={inputClassName}
            value={denomination}
            onChange={(event) => setDenomination(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-name`} className={labelClassName}>
            {t('common.name')}
          </label>
          <input
            id={`${idPrefix}-name`}
            data-testid="admin-submission-edit-name"
            type="text"
            className={inputClassName}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-year`} className={labelClassName}>
            {t('common.year')}
          </label>
          <input
            id={`${idPrefix}-year`}
            data-testid="admin-submission-edit-year"
            type="number"
            className={`w-24 ${inputClassName}`}
            value={year}
            onChange={(event) => setYear(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-mint-mark`} className={labelClassName}>
            {t('common.mintMark')}
          </label>
          <input
            id={`${idPrefix}-mint-mark`}
            data-testid="admin-submission-edit-mint-mark"
            type="text"
            className={inputClassName}
            value={mintMark}
            onChange={(event) => setMintMark(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${idPrefix}-variety`} className={labelClassName}>
            {t('common.variety')}
          </label>
          <input
            id={`${idPrefix}-variety`}
            data-testid="admin-submission-edit-variety"
            type="text"
            className={inputClassName}
            value={variety}
            onChange={(event) => setVariety(event.target.value)}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          data-testid="admin-submission-edit-save"
          className={primaryButtonClassName}
          disabled={isPending}
        >
          {t('admin.saveAndApprove')}
        </button>
        <button
          type="button"
          data-testid="admin-submission-edit-cancel"
          className={secondaryButtonClassName}
          onClick={onCancel}
        >
          {t('common.cancel')}
        </button>
      </div>
    </form>
  );
}
