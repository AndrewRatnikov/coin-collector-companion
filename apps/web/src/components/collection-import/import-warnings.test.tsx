/**
 * Tests for: ImportWarnings
 * Contract source: runs/run_20261104_064643/plan.md § Interface Contract (Component: ImportWarnings)
 * Covers criteria: #6, #13 (from runs/run_20261104_064643/prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import type { ImportPreviewWarning } from '@coin-collector/shared';
import { ImportWarnings } from '@/components/collection-import/import-warnings';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/types';

function warning(line: number, value: string): ImportPreviewWarning {
  return { line, code: 'grade_not_recognised', value };
}

beforeEach(() => {
  localStorage.clear();
});

describe('ImportWarnings', () => {
  it('renders nothing when there are no warnings', () => {
    const { container } = render(<ImportWarnings warnings={[]} />);
    expect(screen.queryByTestId('import-warnings')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });

  it('renders a section with the title and the count', () => {
    render(<ImportWarnings warnings={[warning(4, 'AG'), warning(9, 'MS-65'), warning(11, 'shiny')]} />);
    const section = screen.getByTestId('import-warnings');
    expect(section).toHaveTextContent('Grades not recognised (3)');
    expect(section).toHaveTextContent('These coins are imported without a grade. Use G, VG, F, VF, XF, AU or UNC.');
  });

  it('shows a different count for a different number of warnings', () => {
    render(<ImportWarnings warnings={[warning(2, 'AG')]} />);
    expect(screen.getByTestId('import-warnings')).toHaveTextContent('Grades not recognised (1)');
  });

  it('renders one item per warning in the given order, with line and exact value', () => {
    render(<ImportWarnings warnings={[warning(9, 'MS-65'), warning(4, 'AG')]} />);

    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveAttribute('data-testid', 'import-warning-9');
    expect(items[1]).toHaveAttribute('data-testid', 'import-warning-4');

    expect(within(screen.getByTestId('import-warning-9')).getByTestId('import-warning-line')).toHaveTextContent(
      /^Line 9$/,
    );
    expect(within(screen.getByTestId('import-warning-9')).getByTestId('import-warning-value').textContent).toBe(
      'MS-65',
    );
    expect(within(screen.getByTestId('import-warning-4')).getByTestId('import-warning-line')).toHaveTextContent(
      /^Line 4$/,
    );
    expect(within(screen.getByTestId('import-warning-4')).getByTestId('import-warning-value').textContent).toBe('AG');
  });

  it('shows the message for the warning code in each item', () => {
    render(<ImportWarnings warnings={[warning(5, 'shiny')]} />);
    expect(screen.getByTestId('import-warning-5')).toHaveTextContent('Grade not recognised');
  });

  it('keeps awkward values exactly as given (quotes and inner spaces)', () => {
    render(<ImportWarnings warnings={[warning(6, 'G "4"'), warning(7, 'E F')]} />);
    expect(within(screen.getByTestId('import-warning-6')).getByTestId('import-warning-value').textContent).toBe(
      'G "4"',
    );
    expect(within(screen.getByTestId('import-warning-7')).getByTestId('import-warning-value').textContent).toBe('E F');
  });

  it('renders in Spanish when the language is Spanish', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    render(
      <I18nProvider>
        <ImportWarnings warnings={[warning(4, 'AG')]} />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('import-warnings')).toHaveTextContent('Conservaciones no reconocidas (1)');
    });
    expect(screen.getByTestId('import-warning-line')).toHaveTextContent(/^Línea 4$/);
    expect(screen.getByTestId('import-warning-4')).toHaveTextContent('Conservación no reconocida');
    expect(screen.getByTestId('import-warning-value').textContent).toBe('AG');
  });
});
