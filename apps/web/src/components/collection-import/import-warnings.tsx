'use client';

import type { ImportPreviewWarning } from '@coin-collector/shared';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';

export interface ImportWarningsProps {
  warnings: ImportPreviewWarning[];
}

/**
 * The preview's list of unrecognised grade values: one item per warning, in the order given,
 * with its file line and the raw value exactly as it appeared (trimmed). Renders nothing when
 * there are no warnings.
 */
export function ImportWarnings({ warnings }: ImportWarningsProps) {
  const { t } = useTranslation();
  if (warnings.length === 0) return null;

  return (
    <section
      data-testid="import-warnings"
      className="flex flex-col gap-2 border-y border-[var(--color-divider)] py-4"
    >
      <h2 className="text-[18px] font-normal [font-family:var(--font-heading)]">
        {t('import.warnings.title')} ({warnings.length})
      </h2>
      <p className="text-sm text-[var(--color-neutral-600)]">{t('import.warnings.intro')}</p>
      <ul className="flex flex-col gap-1 text-sm">
        {warnings.map((warning) => (
          <li
            key={warning.line}
            data-testid={`import-warning-${warning.line}`}
            className="flex flex-wrap items-baseline gap-x-3"
          >
            <span
              data-testid="import-warning-line"
              className="[font-family:var(--font-mono)] text-[12px] tabular-nums text-[var(--color-neutral-600)]"
            >
              {t('import.warnings.line')} {warning.line}
            </span>
            <span>{t(`import.warning.${warning.code}` as MessageKey)}</span>
            <span className="text-[var(--color-neutral-600)]">
              &ldquo;<span data-testid="import-warning-value">{warning.value}</span>&rdquo;
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
