/**
 * Tests for: CoinGradePicker
 * Contract source: runs/run_20261102_220909/plan.md § Interface Contract → Component: CoinGradePicker
 * Covers criteria: #1, #5, #9, #10
 *
 * CONTRACT_GAPS: none
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoinGradePicker, type CoinGradePickerProps } from '@/components/catalog/coin-grade-picker';
import { I18nProvider } from '@/lib/i18n/i18n-context';
import { LOCALE_STORAGE_KEY } from '@/lib/i18n/types';

function renderPicker(over: Partial<CoinGradePickerProps> = {}) {
  const onChange = vi.fn();
  const utils = render(<CoinGradePicker layout="panel" grade={null} onChange={onChange} {...over} />);
  return { ...utils, onChange };
}

beforeEach(() => {
  localStorage.clear();
});

describe('CoinGradePicker: structure', () => {
  it('is a native select labelled Grade', () => {
    renderPicker();
    const select = screen.getByLabelText('Grade');

    expect(select.tagName).toBe('SELECT');
    expect(select).toBe(screen.getByTestId('coin-detail-grade-select'));
    expect(screen.getByRole('combobox', { name: 'Grade' })).toBe(select);
  });

  it('has exactly 8 options in order: Not set, then G to UNC with code and name', () => {
    renderPicker();
    const options = within(screen.getByTestId('coin-detail-grade-select')).getAllByRole('option');

    expect(options.map((o) => o.textContent)).toEqual([
      'Not set',
      'G · Good',
      'VG · Very Good',
      'F · Fine',
      'VF · Very Fine',
      'XF · Extremely Fine',
      'AU · About Uncirculated',
      'UNC · Uncirculated',
    ]);
    expect(options.map((o) => o.getAttribute('value'))).toEqual(['', 'G', 'VG', 'F', 'VF', 'XF', 'AU', 'UNC']);
  });

  it('reflects the stored grade, and Not set for null', () => {
    const { rerender, onChange } = renderPicker({ grade: 'XF' });
    expect(screen.getByTestId('coin-detail-grade-select')).toHaveValue('XF');

    rerender(<CoinGradePicker layout="panel" grade="G" onChange={onChange} />);
    expect(screen.getByTestId('coin-detail-grade-select')).toHaveValue('G');

    rerender(<CoinGradePicker layout="panel" grade={null} onChange={onChange} />);
    expect(screen.getByTestId('coin-detail-grade-select')).toHaveValue('');
  });
});

describe('CoinGradePicker: layouts', () => {
  it('uses the bar testid and still labels the select Grade in bar layout', () => {
    renderPicker({ layout: 'bar' });
    const select = screen.getByTestId('coin-detail-mobile-bar-grade-select');

    expect(screen.queryByTestId('coin-detail-grade-select')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Grade')).toBe(select);
  });

  it('gives two pickers on one page their own labels (unique ids)', () => {
    render(
      <>
        <CoinGradePicker layout="panel" grade={null} onChange={vi.fn()} />
        <CoinGradePicker layout="bar" grade={null} onChange={vi.fn()} />
      </>,
    );
    const labelled = screen.getAllByLabelText('Grade');

    expect(labelled).toHaveLength(2);
    expect(labelled[0]).toBe(screen.getByTestId('coin-detail-grade-select'));
    expect(labelled[1]).toBe(screen.getByTestId('coin-detail-mobile-bar-grade-select'));
  });
});

describe('CoinGradePicker: onChange', () => {
  it('calls onChange with the grade code', async () => {
    const { onChange } = renderPicker();
    await userEvent.setup().selectOptions(screen.getByTestId('coin-detail-grade-select'), 'VF');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('VF');
  });

  it('calls onChange with a different code for a different option', async () => {
    const { onChange } = renderPicker({ grade: 'VF' });
    await userEvent.setup().selectOptions(screen.getByTestId('coin-detail-grade-select'), 'UNC');

    expect(onChange).toHaveBeenLastCalledWith('UNC');
  });

  it('calls onChange with null when Not set is chosen', async () => {
    const { onChange } = renderPicker({ grade: 'VF' });
    await userEvent.setup().selectOptions(screen.getByTestId('coin-detail-grade-select'), '');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('works from the bar select too', async () => {
    const { onChange } = renderPicker({ layout: 'bar' });
    await userEvent.setup().selectOptions(screen.getByTestId('coin-detail-mobile-bar-grade-select'), 'AU');

    expect(onChange).toHaveBeenCalledWith('AU');
  });
});

describe('CoinGradePicker: state', () => {
  it('shows no alert when idle', () => {
    renderPicker();
    expect(screen.queryByTestId('coin-detail-grade-error')).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows the localized save-failed alert when failed (panel)', () => {
    renderPicker({ state: 'failed' });
    const alert = screen.getByTestId('coin-detail-grade-error');

    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent('Couldn’t save the grade. It was changed back.');
    expect(screen.queryByTestId('coin-detail-mobile-bar-grade-error')).not.toBeInTheDocument();
  });

  it('shows the bar error testid in the bar layout', () => {
    renderPicker({ layout: 'bar', state: 'failed' });

    expect(screen.getByTestId('coin-detail-mobile-bar-grade-error')).toHaveAttribute('role', 'alert');
    expect(screen.queryByTestId('coin-detail-grade-error')).not.toBeInTheDocument();
  });

  it('marks the select busy but keeps it enabled while pending', async () => {
    const { onChange } = renderPicker({ state: 'pending' });
    const select = screen.getByTestId('coin-detail-grade-select');

    expect(select).toHaveAttribute('aria-busy', 'true');
    expect(select).not.toBeDisabled();
    await userEvent.setup().selectOptions(select, 'F');
    expect(onChange).toHaveBeenCalledWith('F');
  });

  it('is not busy when idle or failed', () => {
    const { rerender, onChange } = renderPicker();
    expect(screen.getByTestId('coin-detail-grade-select')).not.toHaveAttribute('aria-busy');

    rerender(<CoinGradePicker layout="panel" grade={null} onChange={onChange} state="failed" />);
    expect(screen.getByTestId('coin-detail-grade-select')).not.toHaveAttribute('aria-busy');
  });
});

describe('CoinGradePicker: Spanish', () => {
  it('labels the select Conservación and shows ES options', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    render(
      <I18nProvider>
        <CoinGradePicker layout="panel" grade={null} onChange={vi.fn()} />
      </I18nProvider>,
    );

    const select = await screen.findByLabelText('Conservación');
    expect(select).toBe(screen.getByTestId('coin-detail-grade-select'));
    const options = within(select).getAllByRole('option');
    expect(options).toHaveLength(8);
    expect(options[0]).toHaveTextContent('Sin indicar');
    expect(options[4]).toHaveTextContent('MBC · Muy bien conservada');
    expect(options[7]).toHaveTextContent('SC · Sin circular');
    expect(options.map((o) => o.getAttribute('value'))).toEqual(['', 'G', 'VG', 'F', 'VF', 'XF', 'AU', 'UNC']);
  });

  it('sends the neutral code, not the Spanish abbreviation', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    const onChange = vi.fn();
    render(
      <I18nProvider>
        <CoinGradePicker layout="panel" grade={null} onChange={onChange} />
      </I18nProvider>,
    );

    const select = await screen.findByLabelText('Conservación');
    await waitFor(() => expect(within(select).getAllByRole('option')[0]).toHaveTextContent('Sin indicar'));
    await userEvent.setup().selectOptions(select, 'VF');

    expect(onChange).toHaveBeenCalledWith('VF');
  });

  it('shows the Spanish error text', async () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'es');
    render(
      <I18nProvider>
        <CoinGradePicker layout="panel" grade={null} onChange={vi.fn()} state="failed" />
      </I18nProvider>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('coin-detail-grade-error')).toHaveTextContent(
        'No se pudo guardar la conservación. Se ha restaurado la anterior.',
      );
    });
  });
});
