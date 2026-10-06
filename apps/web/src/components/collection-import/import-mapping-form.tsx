'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  IMPORT_FIELDS,
  isImportMappingComplete,
  type ImportColumnMapping,
  type ImportField,
} from '@coin-collector/shared';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';

export interface ImportMappingFormProps {
  headers: string[];
  mapping: ImportColumnMapping;
  onApply: (mapping: ImportColumnMapping) => void;
  disabled?: boolean;
}

const FIELD_SLUGS: Record<ImportField, string> = {
  year: 'year',
  country: 'country',
  denomination: 'denomination',
  mintMark: 'mint-mark',
  variety: 'variety',
  combined: 'combined',
};

const FIELD_LABELS: Record<ImportField, MessageKey> = {
  year: 'import.field.year',
  country: 'import.field.country',
  denomination: 'import.field.denomination',
  mintMark: 'import.field.mintMark',
  variety: 'import.field.variety',
  combined: 'import.field.combined',
};

// The draft starts from `mapping`; the page remounts this form (via `key`) for every new
// preview response, so there's no prop-to-state syncing here.
export function ImportMappingForm({
  headers,
  mapping,
  onApply,
  disabled = false,
}: ImportMappingFormProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<ImportColumnMapping>(() => ({ ...mapping }));
  const complete = isImportMappingComplete(draft);

  function handleChange(field: ImportField, value: string) {
    setDraft((current) => {
      const next = { ...current };
      if (value === '') {
        delete next[field];
      } else {
        next[field] = Number(value);
      }
      return next;
    });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !complete) return;
    const result: ImportColumnMapping = {};
    for (const field of IMPORT_FIELDS) {
      const column = draft[field];
      if (column !== undefined) result[field] = column;
    }
    onApply(result);
  }

  return (
    <form
      data-testid="import-mapping-form"
      onSubmit={handleSubmit}
      className="flex flex-col gap-4 border-y border-[var(--color-divider)] py-4"
    >
      <h2 className="text-[18px] font-normal [font-family:var(--font-heading)]">
        {t('import.mappingTitle')}
      </h2>
      <div className="flex flex-wrap items-end gap-4">
        {IMPORT_FIELDS.map((field) => {
          const id = `import-mapping-${FIELD_SLUGS[field]}`;
          return (
            <div key={field} className="flex flex-col gap-1">
              <label
                htmlFor={id}
                className="text-[11px] uppercase tracking-[0.14em] text-[var(--color-neutral-600)]"
              >
                {t(FIELD_LABELS[field])}
              </label>
              <select
                id={id}
                data-testid={`import-mapping-${FIELD_SLUGS[field]}`}
                value={draft[field] === undefined ? '' : String(draft[field])}
                onChange={(e) => handleChange(field, e.target.value)}
                className="rounded-[var(--radius-sm)] border border-[var(--color-divider)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-200)]"
              >
                <option value="">{t('import.mappingNotMapped')}</option>
                {headers.map((header, index) => (
                  <option key={index} value={String(index)}>
                    {header}
                  </option>
                ))}
              </select>
            </div>
          );
        })}
      </div>
      {!complete && (
        <p
          data-testid="import-mapping-required-hint"
          className="text-sm text-[var(--color-neutral-600)]"
        >
          {t('import.mappingHint')}
        </p>
      )}
      <div>
        <button
          type="submit"
          data-testid="import-mapping-apply"
          disabled={disabled || !complete}
          className="rounded-[2px] border border-[var(--color-accent)] px-[22px] py-[10px] text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--color-accent)] hover:bg-[var(--color-accent-100)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {t('import.mappingApply')}
        </button>
      </div>
    </form>
  );
}
