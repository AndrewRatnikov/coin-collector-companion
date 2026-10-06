'use client';

import { useState } from 'react';
import type { ImportCoinSummary, ImportPreviewRow } from '@coin-collector/shared';
import { CoinSearchPicker } from '@/components/collection-import/coin-search-picker';
import { useTranslation } from '@/lib/i18n/i18n-context';
import type { MessageKey } from '@/lib/i18n/locales/en';
import {
  effectiveCoin,
  formatImportCoinLabel,
  type ImportDecisions,
  type RowDecision,
} from '@/lib/import-selection';

export interface ImportPreviewTableProps {
  rows: ImportPreviewRow[];
  decisions: ImportDecisions;
  onDecisionChange: (line: number, decision: RowDecision) => void;
}

const AUTO: RowDecision = { kind: 'auto' };

const STATUS_CLASS: Record<ImportPreviewRow['status'], string> = {
  matched: 'text-[var(--color-accent-700)]',
  ambiguous: 'text-[var(--color-accent-2-700)]',
  unmatched: 'text-[var(--color-neutral-600)]',
  invalid: 'text-red-700',
};

const smallButtonClassName =
  'text-[12px] uppercase tracking-[0.1em] text-[var(--color-neutral-600)] hover:text-[var(--color-accent)]';

// The table has no column mapping, so the search picker is prefilled from the first cell that
// is a plain 4-digit year.
function yearFromValues(values: string[]): number | null {
  const cell = values.find((value) => /^\d{4}$/.test(value.trim()));
  return cell === undefined ? null : Number(cell.trim());
}

function statusKey(row: ImportPreviewRow, decision: RowDecision): MessageKey {
  if (decision.kind === 'skip') return 'import.status.skipped';
  if (decision.kind === 'pick') return 'import.status.resolved';
  return `import.status.${row.status}` as MessageKey;
}

function ImportPreviewRowItem({
  row,
  decision,
  onDecisionChange,
}: {
  row: ImportPreviewRow;
  decision: RowDecision;
  onDecisionChange: (line: number, decision: RowDecision) => void;
}) {
  const { t } = useTranslation();
  const [searching, setSearching] = useState(false);
  const coin = effectiveCoin(row, decision);
  const isAuto = decision.kind === 'auto';
  const pickedCandidateId =
    decision.kind === 'pick' && row.candidates.some((c) => c.id === decision.coin.id)
      ? decision.coin.id
      : '';

  function pick(picked: ImportCoinSummary) {
    setSearching(false);
    onDecisionChange(row.line, { kind: 'pick', coin: picked });
  }

  function handleCandidateChange(id: string) {
    const candidate = row.candidates.find((c) => c.id === id);
    if (candidate) {
      pick(candidate);
    } else {
      onDecisionChange(row.line, AUTO);
    }
  }

  return (
    <li
      data-testid={`import-row-${row.line}`}
      data-status={row.status}
      data-decision={decision.kind}
      className={`flex flex-col gap-2 border-b border-[var(--color-divider)] px-1 py-3 ${
        decision.kind === 'skip' ? 'opacity-60' : ''
      }`}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="[font-family:var(--font-mono)] text-[12px] tabular-nums text-[var(--color-neutral-600)]">
          {row.line}
        </span>
        <span
          data-testid="import-row-status"
          className={`text-[12px] uppercase tracking-[0.1em] ${STATUS_CLASS[row.status]}`}
        >
          {t(statusKey(row, decision))}
        </span>
        <span data-testid="import-row-values" className="text-sm text-[var(--color-neutral-600)]">
          {row.values.join(' · ')}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        {coin && <span data-testid="import-row-coin">{formatImportCoinLabel(coin)}</span>}
        {row.reason !== null && isAuto && (
          <span data-testid="import-row-reason" className="text-[var(--color-neutral-600)]">
            {t(`import.reason.${row.reason}` as MessageKey)}
          </span>
        )}
        {coin?.owned && (
          <span
            data-testid="import-row-flag-owned"
            className="rounded-[2px] bg-[var(--color-neutral-100)] px-2 py-[2px] text-[11px] uppercase tracking-[0.1em]"
          >
            {t('import.flag.alreadyOwned')}
          </span>
        )}
        {row.duplicateOfLine !== null && isAuto && (
          <span
            data-testid="import-row-flag-duplicate"
            className="rounded-[2px] bg-[var(--color-neutral-100)] px-2 py-[2px] text-[11px] uppercase tracking-[0.1em]"
          >
            {t('import.flag.duplicate')} ({row.duplicateOfLine})
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {row.status === 'ambiguous' && decision.kind !== 'skip' && (
          <select
            data-testid="import-row-candidates"
            aria-label={t('import.row.chooseCandidate')}
            value={pickedCandidateId}
            onChange={(e) => handleCandidateChange(e.target.value)}
            className="max-w-full rounded-[var(--radius-sm)] border border-[var(--color-divider)] bg-[var(--color-surface)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-200)]"
          >
            <option value="">{t('import.row.chooseCandidate')}</option>
            {row.candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {formatImportCoinLabel(candidate)}
              </option>
            ))}
          </select>
        )}
        {isAuto && row.status !== 'matched' && (
          <button
            type="button"
            data-testid="import-row-search-toggle"
            onClick={() => setSearching((open) => !open)}
            aria-expanded={searching}
            className={smallButtonClassName}
          >
            {t('import.row.search')}
          </button>
        )}
        {decision.kind !== 'skip' && (
          <button
            type="button"
            data-testid="import-row-skip"
            onClick={() => {
              setSearching(false);
              onDecisionChange(row.line, { kind: 'skip' });
            }}
            className={smallButtonClassName}
          >
            {t('import.row.skip')}
          </button>
        )}
        {!isAuto && (
          <button
            type="button"
            data-testid="import-row-reset"
            onClick={() => onDecisionChange(row.line, AUTO)}
            className={smallButtonClassName}
          >
            {t('import.row.reset')}
          </button>
        )}
      </div>

      {searching && isAuto && (
        <CoinSearchPicker
          initialYear={yearFromValues(row.values)}
          onPick={pick}
          onCancel={() => setSearching(false)}
        />
      )}
    </li>
  );
}

export function ImportPreviewTable({ rows, decisions, onDecisionChange }: ImportPreviewTableProps) {
  return (
    <ul
      data-testid="import-preview-table"
      className="flex flex-col border-t border-[var(--color-divider)]"
    >
      {rows.map((row) => (
        <ImportPreviewRowItem
          key={row.line}
          row={row}
          decision={decisions[row.line] ?? AUTO}
          onDecisionChange={onDecisionChange}
        />
      ))}
    </ul>
  );
}
