/**
 * Tests for: ImportPreviewTable (grade chip and grade-warning flag)
 * Contract source: runs/run_20261104_064643/plan.md § Interface Contract (Component: ImportPreviewTable)
 * Covers criteria: #6, #7 (from runs/run_20261104_064643/prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { ImportCoinSummary, ImportPreviewRow, ImportPreviewWarning } from '@coin-collector/shared';
import { ImportPreviewTable } from '@/components/collection-import/import-preview-table';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/types';
import type { ImportDecisions } from '@/lib/import-selection';

const COIN_A: ImportCoinSummary = {
  id: 'coin-a',
  country: 'USA',
  denomination: 'Cent',
  year: 1950,
  mintMark: 'D',
  variety: '',
  name: 'Coin A',
  owned: false,
};

function row(overrides: Partial<ImportPreviewRow> & Pick<ImportPreviewRow, 'line'>): ImportPreviewRow {
  return {
    values: ['1950', 'USA', 'Cent'],
    status: 'matched',
    reason: null,
    coin: COIN_A,
    candidates: [],
    alreadyOwned: false,
    duplicateOfLine: null,
    grade: null,
    ...overrides,
  };
}

function warning(line: number, value: string): ImportPreviewWarning {
  return { line, code: 'grade_not_recognised', value };
}

function renderTable(
  rows: ImportPreviewRow[],
  options: { warnings?: ImportPreviewWarning[]; decisions?: ImportDecisions } = {},
) {
  return render(
    <ImportPreviewTable
      rows={rows}
      decisions={options.decisions ?? {}}
      onDecisionChange={vi.fn()}
      warnings={options.warnings}
    />,
  );
}

function rowEl(line: number): HTMLElement {
  return screen.getByTestId(`import-row-${line}`);
}

beforeEach(() => {
  localStorage.clear();
});

describe('ImportPreviewTable grade chip', () => {
  it('shows a chip with the grade code only on rows that have a grade', () => {
    renderTable([row({ line: 2, grade: 'VF' }), row({ line: 3, grade: null }), row({ line: 4, grade: 'AU' })]);

    const chip2 = within(rowEl(2)).getByTestId('import-row-grade');
    expect(chip2).toHaveTextContent(/^VF$/);
    expect(chip2).toHaveAttribute('data-grade', 'VF');
    expect(within(rowEl(3)).queryByTestId('import-row-grade')).not.toBeInTheDocument();
    const chip4 = within(rowEl(4)).getByTestId('import-row-grade');
    expect(chip4).toHaveTextContent(/^AU$/);
    expect(chip4).toHaveAttribute('data-grade', 'AU');
  });

  it('shows no chip at all when no row has a grade', () => {
    renderTable([row({ line: 2 }), row({ line: 3 })]);
    expect(screen.queryByTestId('import-row-grade')).not.toBeInTheDocument();
  });

  it('shows the chip whatever the row status (unmatched, invalid) and after a skip decision', () => {
    renderTable(
      [
        row({ line: 2, status: 'unmatched', reason: 'no_such_coin', coin: null, grade: 'G' }),
        row({ line: 3, status: 'invalid', reason: 'year_missing', coin: null, grade: 'UNC' }),
        row({ line: 4, grade: 'F' }),
      ],
      { decisions: { 4: { kind: 'skip' } } },
    );

    expect(within(rowEl(2)).getByTestId('import-row-grade')).toHaveTextContent(/^G$/);
    expect(within(rowEl(3)).getByTestId('import-row-grade')).toHaveTextContent(/^UNC$/);
    expect(within(rowEl(4)).getByTestId('import-row-grade')).toHaveTextContent(/^F$/);
  });

  it('shows the Spanish abbreviation when the language is Spanish', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    render(
      <I18nProvider>
        <ImportPreviewTable
          rows={[row({ line: 2, grade: 'VF' }), row({ line: 3, grade: 'UNC' })]}
          decisions={{}}
          onDecisionChange={vi.fn()}
        />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(within(rowEl(2)).getByTestId('import-row-grade')).toHaveTextContent(/^MBC$/);
    });
    expect(within(rowEl(2)).getByTestId('import-row-grade')).toHaveAttribute('data-grade', 'VF');
    expect(within(rowEl(3)).getByTestId('import-row-grade')).toHaveTextContent(/^SC$/);
  });
});

describe('ImportPreviewTable grade warning flag', () => {
  it('shows the flag only on the rows whose line has a warning', () => {
    renderTable([row({ line: 2 }), row({ line: 3 }), row({ line: 4 })], { warnings: [warning(3, 'shiny')] });

    expect(within(rowEl(2)).queryByTestId('import-row-grade-warning')).not.toBeInTheDocument();
    expect(within(rowEl(3)).getByTestId('import-row-grade-warning')).toHaveTextContent('Grade not recognised');
    expect(within(rowEl(4)).queryByTestId('import-row-grade-warning')).not.toBeInTheDocument();
  });

  it('flags every line that has a warning', () => {
    renderTable([row({ line: 2 }), row({ line: 3 }), row({ line: 4 })], {
      warnings: [warning(2, 'AG'), warning(4, 'MS-65')],
    });

    expect(within(rowEl(2)).getByTestId('import-row-grade-warning')).toBeInTheDocument();
    expect(within(rowEl(3)).queryByTestId('import-row-grade-warning')).not.toBeInTheDocument();
    expect(within(rowEl(4)).getByTestId('import-row-grade-warning')).toBeInTheDocument();
  });

  it('shows no flag when warnings is omitted or empty', () => {
    const { unmount } = renderTable([row({ line: 2 })]);
    expect(screen.queryByTestId('import-row-grade-warning')).not.toBeInTheDocument();
    unmount();
    renderTable([row({ line: 2 })], { warnings: [] });
    expect(screen.queryByTestId('import-row-grade-warning')).not.toBeInTheDocument();
  });

  it('does not change the status text or data-status of a warned row', () => {
    renderTable([row({ line: 2, grade: null }), row({ line: 3, grade: null })], { warnings: [warning(3, 'shiny')] });

    expect(rowEl(3)).toHaveAttribute('data-status', 'matched');
    expect(within(rowEl(3)).getByTestId('import-row-status')).toHaveTextContent('Matched');
    expect(within(rowEl(3)).getByTestId('import-row-status').textContent).toBe(
      within(rowEl(2)).getByTestId('import-row-status').textContent,
    );
    // an unrecognised value has no grade, so no chip next to the flag
    expect(within(rowEl(3)).queryByTestId('import-row-grade')).not.toBeInTheDocument();
  });

  it('shows the flag on unmatched rows and on rows the user skipped', () => {
    renderTable(
      [
        row({ line: 2, status: 'unmatched', reason: 'no_such_coin', coin: null }),
        row({ line: 3 }),
      ],
      { warnings: [warning(2, 'AG'), warning(3, 'Proof')], decisions: { 3: { kind: 'skip' } } },
    );

    expect(within(rowEl(2)).getByTestId('import-row-grade-warning')).toBeInTheDocument();
    expect(rowEl(2)).toHaveAttribute('data-status', 'unmatched');
    expect(within(rowEl(3)).getByTestId('import-row-grade-warning')).toBeInTheDocument();
    expect(rowEl(3)).toHaveAttribute('data-decision', 'skip');
  });

  it('shows the Spanish text when the language is Spanish', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    render(
      <I18nProvider>
        <ImportPreviewTable
          rows={[row({ line: 2 })]}
          decisions={{}}
          onDecisionChange={vi.fn()}
          warnings={[warning(2, 'shiny')]}
        />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(within(rowEl(2)).getByTestId('import-row-grade-warning')).toHaveTextContent('Conservación no reconocida');
    });
  });
});
