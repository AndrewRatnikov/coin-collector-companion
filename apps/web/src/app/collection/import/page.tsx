'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import Link from 'next/link';
import {
  IMPORT_MAX_FILE_BYTES,
  type ImportColumnMapping,
  type ImportConfirmResponse,
  type ImportPreviewResponse,
} from '@coin-collector/shared';
import { RequireAuth } from '@/components/auth/require-auth';
import { ImportMappingForm } from '@/components/collection-import/import-mapping-form';
import { ImportPreviewTable } from '@/components/collection-import/import-preview-table';
import { useConfirmImport, usePreviewImport } from '@/lib/hooks/use-collection-import';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';
import {
  countSkipped,
  countToImport,
  importErrorKey,
  selectedCoinIds,
  type ImportDecisions,
  type RowDecision,
} from '@/lib/import-selection';

type Step = 'upload' | 'preview' | 'result';

const labelClassName = 'text-[11px] uppercase tracking-[0.14em] text-[var(--color-neutral-600)]';
const primaryButtonClassName =
  'rounded-[2px] bg-[var(--color-accent)] px-[26px] py-[13px] text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-bg)] hover:bg-[color-mix(in_srgb,var(--color-accent)_86%,#000)] disabled:cursor-not-allowed disabled:opacity-50';
const secondaryButtonClassName =
  'text-[13px] text-[var(--color-neutral-600)] hover:text-[var(--color-accent)]';

function CollectionImportFlow() {
  const { t } = useTranslation();
  const previewMutation = usePreviewImport();
  const confirmMutation = useConfirmImport();

  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  // Bumped on every new preview response; keys the mapping form and table so their local
  // state starts fresh from the new response.
  const [previewVersion, setPreviewVersion] = useState(0);
  const [decisions, setDecisions] = useState<ImportDecisions>({});
  const [result, setResult] = useState<ImportConfirmResponse | null>(null);
  const [skippedAtConfirm, setSkippedAtConfirm] = useState(0);
  const [uploadError, setUploadError] = useState<MessageKey | null>(null);
  const [confirmError, setConfirmError] = useState<MessageKey | null>(null);

  async function runPreview(selected: File, mapping?: ImportColumnMapping) {
    setUploadError(null);
    setConfirmError(null);
    try {
      const response = await previewMutation.mutateAsync({ file: selected, mapping });
      setPreview(response);
      setDecisions({});
      setPreviewVersion((version) => version + 1);
      setStep('preview');
    } catch (error) {
      setUploadError(importErrorKey(error));
    }
  }

  function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file) {
      setUploadError('import.error.fileRequired');
      return;
    }
    if (file.size > IMPORT_MAX_FILE_BYTES) {
      setUploadError('import.error.fileTooLarge');
      return;
    }
    void runPreview(file);
  }

  function handleApplyMapping(mapping: ImportColumnMapping) {
    if (file) void runPreview(file, mapping);
  }

  function handleDecisionChange(line: number, decision: RowDecision) {
    setDecisions((current) => ({ ...current, [line]: decision }));
  }

  async function handleConfirm() {
    if (!preview) return;
    setConfirmError(null);
    const skipped = countSkipped(preview.rows, decisions);
    try {
      const response = await confirmMutation.mutateAsync(selectedCoinIds(preview.rows, decisions));
      setResult(response);
      setSkippedAtConfirm(skipped);
      setStep('result');
    } catch (error) {
      setConfirmError(importErrorKey(error));
    }
  }

  function startOver() {
    previewMutation.reset();
    confirmMutation.reset();
    setStep('upload');
    setFile(null);
    setPreview(null);
    setDecisions({});
    setResult(null);
    setSkippedAtConfirm(0);
    setUploadError(null);
    setConfirmError(null);
  }

  const toImport = preview ? countToImport(preview.rows, decisions) : 0;

  const uploadErrorElement = uploadError && (
    <p data-testid="import-upload-error" role="alert" className="text-sm text-red-700">
      {t(uploadError)}
    </p>
  );
  const loadingElement = previewMutation.isPending && (
    <p data-testid="import-loading" className="text-sm text-[var(--color-neutral-600)]">
      {t('import.previewing')}
    </p>
  );

  return (
    <main
      data-testid="collection-import-page"
      className="mx-auto flex w-full max-w-[1080px] flex-1 flex-col gap-6 px-[clamp(20px,5vw,48px)] py-10 text-[var(--color-text)]"
    >
      <h1 className="text-[28px] font-normal [font-family:var(--font-heading)]">
        {t('import.title')}
      </h1>

      {step === 'upload' && (
        <form onSubmit={handleUpload} className="flex flex-col gap-4">
          <p className="text-sm text-[var(--color-neutral-600)]">{t('import.intro')}</p>
          <div className="flex flex-col gap-1">
            <label htmlFor="import-file" className={labelClassName}>
              {t('import.fileLabel')}
            </label>
            <input
              id="import-file"
              data-testid="import-file-input"
              type="file"
              accept=".csv,text/csv"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setUploadError(null);
              }}
              className="text-sm"
            />
            <p
              data-testid="import-limits-hint"
              className="text-[13px] text-[var(--color-neutral-600)]"
            >
              {t('import.limitsHint')}
            </p>
          </div>
          <div>
            <button
              type="submit"
              data-testid="import-upload-submit"
              disabled={previewMutation.isPending}
              className={primaryButtonClassName}
            >
              {t('import.previewButton')}
            </button>
          </div>
          {loadingElement}
          {uploadErrorElement}
        </form>
      )}

      {step === 'preview' && preview && (
        <>
          <ImportMappingForm
            key={`mapping-${previewVersion}`}
            headers={preview.headers}
            mapping={preview.mapping}
            onApply={handleApplyMapping}
            disabled={previewMutation.isPending}
          />
          {loadingElement}
          {uploadErrorElement}

          <dl
            data-testid="import-summary"
            className="grid grid-cols-2 gap-x-6 gap-y-3 border-y border-[var(--color-divider)] py-4 sm:grid-cols-4"
          >
            <div className="flex flex-col">
              <dt className={labelClassName}>{t('import.summary.matched')}</dt>
              <dd data-testid="import-summary-matched" className="text-[22px] tabular-nums">
                {preview.summary.matched}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className={labelClassName}>{t('import.summary.alreadyOwned')}</dt>
              <dd data-testid="import-summary-already-owned" className="text-[22px] tabular-nums">
                {preview.summary.alreadyOwned}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className={labelClassName}>{t('import.summary.duplicate')}</dt>
              <dd data-testid="import-summary-duplicate" className="text-[22px] tabular-nums">
                {preview.summary.duplicateInFile}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className={labelClassName}>{t('import.summary.ambiguous')}</dt>
              <dd data-testid="import-summary-ambiguous" className="text-[22px] tabular-nums">
                {preview.summary.ambiguous}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className={labelClassName}>{t('import.summary.unmatched')}</dt>
              <dd data-testid="import-summary-unmatched" className="text-[22px] tabular-nums">
                {preview.summary.unmatched}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className={labelClassName}>{t('import.summary.invalid')}</dt>
              <dd data-testid="import-summary-invalid" className="text-[22px] tabular-nums">
                {preview.summary.invalid}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className={labelClassName}>{t('import.summary.toImport')}</dt>
              <dd
                data-testid="import-summary-to-import"
                className="text-[22px] tabular-nums text-[var(--color-accent)]"
              >
                {toImport}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap items-center gap-4">
            <button
              type="button"
              data-testid="import-confirm"
              onClick={() => void handleConfirm()}
              disabled={toImport === 0 || confirmMutation.isPending}
              className={primaryButtonClassName}
            >
              {t('import.confirm')}
            </button>
            <button
              type="button"
              data-testid="import-start-over"
              onClick={startOver}
              className={secondaryButtonClassName}
            >
              {t('import.startOver')}
            </button>
          </div>
          {confirmError && (
            <p data-testid="import-confirm-error" role="alert" className="text-sm text-red-700">
              {t(confirmError)}
            </p>
          )}

          <ImportPreviewTable
            key={`table-${previewVersion}`}
            rows={preview.rows}
            decisions={decisions}
            onDecisionChange={handleDecisionChange}
          />
        </>
      )}

      {step === 'result' && result && (
        <section data-testid="import-result" className="flex flex-col gap-4">
          <h2 className="text-[20px] font-normal [font-family:var(--font-heading)]">
            {t('import.result.title')}
          </h2>
          <dl className="grid grid-cols-1 gap-y-3 border-y border-[var(--color-divider)] py-4 sm:grid-cols-3">
            <div className="flex flex-col">
              <dt className={labelClassName}>{t('import.result.created')}</dt>
              <dd data-testid="import-result-created" className="text-[22px] tabular-nums">
                {result.created}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className={labelClassName}>{t('import.result.alreadyOwned')}</dt>
              <dd data-testid="import-result-already-owned" className="text-[22px] tabular-nums">
                {result.alreadyOwned}
              </dd>
            </div>
            <div className="flex flex-col">
              <dt className={labelClassName}>{t('import.result.skipped')}</dt>
              <dd data-testid="import-result-skipped" className="text-[22px] tabular-nums">
                {skippedAtConfirm}
              </dd>
            </div>
          </dl>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/collection"
              data-testid="import-result-collection-link"
              className="text-[13px] text-[var(--color-accent)] underline-offset-4 hover:underline"
            >
              {t('import.result.viewCollection')}
            </Link>
            <button
              type="button"
              data-testid="import-result-again"
              onClick={startOver}
              className={secondaryButtonClassName}
            >
              {t('import.result.importAnother')}
            </button>
          </div>
        </section>
      )}
    </main>
  );
}

export default function CollectionImportPage() {
  return (
    <RequireAuth>
      <CollectionImportFlow />
    </RequireAuth>
  );
}
