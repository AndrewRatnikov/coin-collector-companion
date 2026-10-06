/**
 * Tests for: ImportMappingForm
 * Contract source: runs/run_20261005_212015/plan.md § Interface Contract (Component: ImportMappingForm)
 * Covers criteria: #13 (from runs/run_20261005_212015/prd.md)
 *
 * CONTRACT_GAP: none.
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImportMappingForm } from '@/components/collection-import/import-mapping-form';

const HEADERS = ['Year', 'Country', 'Denomination', 'Mint', 'Notes'];

const FIELD_TESTIDS = [
  'import-mapping-year',
  'import-mapping-country',
  'import-mapping-denomination',
  'import-mapping-mint-mark',
  'import-mapping-variety',
  'import-mapping-combined',
];

function selectOf(testId: string): HTMLSelectElement {
  const el = screen.getByTestId(testId);
  if (!(el instanceof HTMLSelectElement)) throw new Error(`${testId} is not a select`);
  return el;
}

describe('ImportMappingForm', () => {
  describe('structure', () => {
    it('renders a form with one select per field, in IMPORT_FIELDS order', () => {
      render(<ImportMappingForm headers={HEADERS} mapping={{}} onApply={vi.fn()} />);
      const form = screen.getByTestId('import-mapping-form');
      const selects = within(form).getAllByRole('combobox');
      expect(selects.map((s) => s.getAttribute('data-testid'))).toEqual(FIELD_TESTIDS);
    });

    it('offers "not mapped" (value "") plus one option per header with the column index as value', () => {
      render(<ImportMappingForm headers={HEADERS} mapping={{}} onApply={vi.fn()} />);
      for (const testId of FIELD_TESTIDS) {
        const options = within(selectOf(testId)).getAllByRole('option');
        expect(options.map((o) => o.getAttribute('value'))).toEqual(['', '0', '1', '2', '3', '4']);
        expect(options[0]).toHaveTextContent('Not mapped');
        expect(options.slice(1).map((o) => o.textContent)).toEqual(HEADERS);
      }
    });

    it('builds the options from the headers it is given', () => {
      render(<ImportMappingForm headers={['A', 'B']} mapping={{}} onApply={vi.fn()} />);
      const options = within(selectOf('import-mapping-year')).getAllByRole('option');
      expect(options.map((o) => o.getAttribute('value'))).toEqual(['', '0', '1']);
    });
  });

  describe('initial draft', () => {
    it('selects the mapped column for each field and "not mapped" for the rest', () => {
      render(
        <ImportMappingForm
          headers={HEADERS}
          mapping={{ year: 0, country: 1, denomination: 2, mintMark: 3 }}
          onApply={vi.fn()}
        />,
      );
      expect(selectOf('import-mapping-year').value).toBe('0');
      expect(selectOf('import-mapping-country').value).toBe('1');
      expect(selectOf('import-mapping-denomination').value).toBe('2');
      expect(selectOf('import-mapping-mint-mark').value).toBe('3');
      expect(selectOf('import-mapping-variety').value).toBe('');
      expect(selectOf('import-mapping-combined').value).toBe('');
    });

    it('reflects a different mapping prop with different selections', () => {
      render(
        <ImportMappingForm
          headers={HEADERS}
          mapping={{ combined: 4, country: 0, denomination: 1, variety: 2 }}
          onApply={vi.fn()}
        />,
      );
      expect(selectOf('import-mapping-combined').value).toBe('4');
      expect(selectOf('import-mapping-country').value).toBe('0');
      expect(selectOf('import-mapping-variety').value).toBe('2');
      expect(selectOf('import-mapping-year').value).toBe('');
    });
  });

  describe('apply and the required-field rule', () => {
    it('enables Apply and hides the hint when year, country and denomination are mapped', () => {
      render(
        <ImportMappingForm headers={HEADERS} mapping={{ year: 0, country: 1, denomination: 2 }} onApply={vi.fn()} />,
      );
      expect(screen.getByTestId('import-mapping-apply')).toBeEnabled();
      expect(screen.queryByTestId('import-mapping-required-hint')).not.toBeInTheDocument();
    });

    it('accepts the combined field in place of year', () => {
      render(
        <ImportMappingForm headers={HEADERS} mapping={{ combined: 0, country: 1, denomination: 2 }} onApply={vi.fn()} />,
      );
      expect(screen.getByTestId('import-mapping-apply')).toBeEnabled();
      expect(screen.queryByTestId('import-mapping-required-hint')).not.toBeInTheDocument();
    });

    it('disables Apply and shows the hint while a required field is missing', () => {
      render(<ImportMappingForm headers={HEADERS} mapping={{ year: 0, country: 1 }} onApply={vi.fn()} />);
      expect(screen.getByTestId('import-mapping-apply')).toBeDisabled();
      expect(screen.getByTestId('import-mapping-required-hint')).toHaveTextContent(
        'Map Year (or Coin), Country and Denomination to continue.',
      );
    });

    it('disables Apply for an empty mapping and for a mapping without a year or combined column', () => {
      const { unmount } = render(<ImportMappingForm headers={HEADERS} mapping={{}} onApply={vi.fn()} />);
      expect(screen.getByTestId('import-mapping-apply')).toBeDisabled();
      unmount();
      render(<ImportMappingForm headers={HEADERS} mapping={{ country: 1, denomination: 2 }} onApply={vi.fn()} />);
      expect(screen.getByTestId('import-mapping-apply')).toBeDisabled();
    });

    it('enables Apply once the user completes the mapping and hides the hint', async () => {
      const user = userEvent.setup();
      render(<ImportMappingForm headers={HEADERS} mapping={{ year: 0 }} onApply={vi.fn()} />);
      expect(screen.getByTestId('import-mapping-apply')).toBeDisabled();

      await user.selectOptions(selectOf('import-mapping-country'), '1');
      expect(screen.getByTestId('import-mapping-apply')).toBeDisabled();

      await user.selectOptions(selectOf('import-mapping-denomination'), '2');
      expect(screen.getByTestId('import-mapping-apply')).toBeEnabled();
      expect(screen.queryByTestId('import-mapping-required-hint')).not.toBeInTheDocument();
    });

    it('disables Apply again when the user unmaps a required field', async () => {
      const user = userEvent.setup();
      render(
        <ImportMappingForm headers={HEADERS} mapping={{ year: 0, country: 1, denomination: 2 }} onApply={vi.fn()} />,
      );
      await user.selectOptions(selectOf('import-mapping-country'), '');
      expect(screen.getByTestId('import-mapping-apply')).toBeDisabled();
      expect(screen.getByTestId('import-mapping-required-hint')).toBeInTheDocument();
    });

    it('keeps Apply disabled when the disabled prop is set, even for a complete mapping', () => {
      render(
        <ImportMappingForm
          headers={HEADERS}
          mapping={{ year: 0, country: 1, denomination: 2 }}
          onApply={vi.fn()}
          disabled
        />,
      );
      expect(screen.getByTestId('import-mapping-apply')).toBeDisabled();
    });
  });

  describe('onApply', () => {
    it('calls onApply with only the mapped fields as numbers', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      render(
        <ImportMappingForm
          headers={HEADERS}
          mapping={{ year: 0, country: 1, denomination: 2, mintMark: 3 }}
          onApply={onApply}
        />,
      );

      await user.click(screen.getByTestId('import-mapping-apply'));

      expect(onApply).toHaveBeenCalledTimes(1);
      expect(onApply).toHaveBeenCalledWith({ year: 0, country: 1, denomination: 2, mintMark: 3 });
      expect(onApply.mock.calls[0][0]).not.toHaveProperty('variety');
      expect(onApply.mock.calls[0][0]).not.toHaveProperty('combined');
    });

    it('sends the edited draft, not the original mapping', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      render(
        <ImportMappingForm headers={HEADERS} mapping={{ year: 0, country: 1, denomination: 2 }} onApply={onApply} />,
      );

      await user.selectOptions(selectOf('import-mapping-year'), '4');
      await user.selectOptions(selectOf('import-mapping-mint-mark'), '3');
      await user.click(screen.getByTestId('import-mapping-apply'));

      expect(onApply).toHaveBeenCalledWith({ year: 4, country: 1, denomination: 2, mintMark: 3 });
    });

    it('omits a field the user set back to "not mapped"', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      render(
        <ImportMappingForm
          headers={HEADERS}
          mapping={{ year: 0, country: 1, denomination: 2, variety: 4 }}
          onApply={onApply}
        />,
      );

      await user.selectOptions(selectOf('import-mapping-variety'), '');
      await user.click(screen.getByTestId('import-mapping-apply'));

      expect(onApply).toHaveBeenCalledWith({ year: 0, country: 1, denomination: 2 });
    });

    it('does not call onApply when Apply is disabled', async () => {
      const user = userEvent.setup();
      const onApply = vi.fn();
      render(<ImportMappingForm headers={HEADERS} mapping={{ year: 0 }} onApply={onApply} />);
      await user.click(screen.getByTestId('import-mapping-apply'));
      expect(onApply).not.toHaveBeenCalled();
    });
  });
});
