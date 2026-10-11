/**
 * Tests for: CatalogFilterSidebar
 * Contract source: runs/run_20261011_105146/plan.md § Interface Contract → Component: CatalogFilterSidebar
 * Covers criteria: #8, #9, #10 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * The component is controlled: every test passes `state` in and asserts the `onChange` /
 * `onClearAll` calls. Year debounce tests use vi.useFakeTimers() with fireEvent (userEvent is not
 * set up with advanceTimers here).
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { CatalogFacets } from '@coin-collector/shared';
import CatalogFilterSidebar, { type CatalogFilterSidebarProps } from '@/components/catalog/catalog-filter-sidebar';
import { EMPTY_CATALOG_VIEW_STATE, type CatalogViewState } from '@/lib/catalog-view';

const FACETS: CatalogFacets = {
  countries: ['Ukraine', 'USA'],
  denominations: ['5 Kopiyok', '10 Hryvnias', '1 Cent'],
};

function setup(overrides: Partial<CatalogFilterSidebarProps> = {}, stateOverrides: Partial<CatalogViewState> = {}) {
  const onChange = vi.fn();
  const onClearAll = vi.fn();
  const props: CatalogFilterSidebarProps = {
    state: { ...EMPTY_CATALOG_VIEW_STATE, ...stateOverrides },
    facets: FACETS,
    isLoggedIn: false,
    onChange,
    onClearAll,
    ...overrides,
  };
  const view = render(<CatalogFilterSidebar {...props} />);
  return { onChange, onClearAll, props, ...view };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('CatalogFilterSidebar', () => {
  describe('country (criteria #8, #9)', () => {
    it('renders a radio per facet country plus All countries', () => {
      setup();

      expect(screen.getByTestId('catalog-filter-country-Ukraine')).toHaveAttribute('type', 'radio');
      expect(screen.getByTestId('catalog-filter-country-USA')).toHaveAttribute('type', 'radio');
      expect(screen.getByTestId('catalog-filter-country-all')).toHaveAttribute('type', 'radio');
    });

    it('checks All countries when no country is selected', () => {
      setup();

      expect(screen.getByTestId('catalog-filter-country-all')).toBeChecked();
      expect(screen.getByTestId('catalog-filter-country-Ukraine')).not.toBeChecked();
    });

    it('checks the selected country and unchecks the others', () => {
      setup({}, { country: 'USA' });

      expect(screen.getByTestId('catalog-filter-country-USA')).toBeChecked();
      expect(screen.getByTestId('catalog-filter-country-Ukraine')).not.toBeChecked();
      expect(screen.getByTestId('catalog-filter-country-all')).not.toBeChecked();
    });

    it('choosing a country calls onChange with the country and clears denominations', async () => {
      const user = userEvent.setup();
      const { onChange } = setup({}, { denominations: ['5 Kopiyok'] });

      await user.click(screen.getByTestId('catalog-filter-country-Ukraine'));

      expect(onChange).toHaveBeenCalledWith({ country: 'Ukraine', denominations: [] });
    });

    it('choosing a different country passes that country', async () => {
      const user = userEvent.setup();
      const { onChange } = setup();

      await user.click(screen.getByTestId('catalog-filter-country-USA'));

      expect(onChange).toHaveBeenCalledWith({ country: 'USA', denominations: [] });
    });

    it('choosing All countries calls onChange with an empty country and no denominations', async () => {
      const user = userEvent.setup();
      const { onChange } = setup({}, { country: 'Ukraine', denominations: ['5 Kopiyok'] });

      await user.click(screen.getByTestId('catalog-filter-country-all'));

      expect(onChange).toHaveBeenCalledWith({ country: '', denominations: [] });
    });

    it('still renders (and checks) the selected country when it is missing from the facets', () => {
      setup({ facets: undefined }, { country: 'Ukraine' });

      expect(screen.getByTestId('catalog-filter-country-Ukraine')).toBeChecked();
    });

    it('uses the idPrefix for the radio group name, so two sidebars keep independent groups', () => {
      setup({ idPrefix: 'catalog-sheet' });

      const name = screen.getByTestId('catalog-filter-country-Ukraine').getAttribute('name');
      expect(name).toContain('catalog-sheet');
      expect(screen.getByTestId('catalog-filter-country-all')).toHaveAttribute('name', name);
    });

    it('defaults the radio group name to the catalog-sidebar prefix', () => {
      setup();

      expect(screen.getByTestId('catalog-filter-country-Ukraine').getAttribute('name')).toContain('catalog-sidebar');
    });
  });

  describe('denomination (criteria #8, #9)', () => {
    it('renders a checkbox per facet denomination', () => {
      setup();

      for (const id of [
        'catalog-filter-denomination-5 Kopiyok',
        'catalog-filter-denomination-10 Hryvnias',
        'catalog-filter-denomination-1 Cent',
      ]) {
        expect(screen.getByTestId(id)).toHaveAttribute('type', 'checkbox');
      }
    });

    it('starts all unticked when nothing is selected', () => {
      setup();

      expect(screen.getByTestId('catalog-filter-denomination-5 Kopiyok')).not.toBeChecked();
      expect(screen.getByTestId('catalog-filter-denomination-10 Hryvnias')).not.toBeChecked();
      expect(screen.getByTestId('catalog-filter-denomination-1 Cent')).not.toBeChecked();
    });

    it('ticks the selected denominations', () => {
      setup({}, { denominations: ['10 Hryvnias'] });

      expect(screen.getByTestId('catalog-filter-denomination-10 Hryvnias')).toBeChecked();
      expect(screen.getByTestId('catalog-filter-denomination-5 Kopiyok')).not.toBeChecked();
    });

    it('ticking one calls onChange with just that denomination', async () => {
      const user = userEvent.setup();
      const { onChange } = setup();

      await user.click(screen.getByTestId('catalog-filter-denomination-10 Hryvnias'));

      expect(onChange).toHaveBeenCalledWith({ denominations: ['10 Hryvnias'] });
    });

    it('ticking a second one keeps facet order, not click order', async () => {
      const user = userEvent.setup();
      const { onChange } = setup({}, { denominations: ['1 Cent'] });

      await user.click(screen.getByTestId('catalog-filter-denomination-5 Kopiyok'));

      expect(onChange).toHaveBeenCalledWith({ denominations: ['5 Kopiyok', '1 Cent'] });
    });

    it('unticking removes only that denomination', async () => {
      const user = userEvent.setup();
      const { onChange } = setup({}, { denominations: ['5 Kopiyok', '1 Cent'] });

      await user.click(screen.getByTestId('catalog-filter-denomination-5 Kopiyok'));

      expect(onChange).toHaveBeenCalledWith({ denominations: ['1 Cent'] });
    });

    it('still renders a selected denomination that is missing from the facets', () => {
      setup({}, { denominations: ['2 Euro'] });

      expect(screen.getByRole('checkbox', { name: /2 Euro/ })).toBeChecked();
    });

    it('renders no denomination options (and no error) when there are no facets yet', () => {
      setup({ facets: undefined });

      expect(screen.queryByTestId('catalog-filter-denomination-5 Kopiyok')).not.toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-country-all')).toBeInTheDocument();
      // Only "Key dates only" remains as a checkbox when logged out.
      expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    });
  });

  describe('years (criterion #10)', () => {
    it('shows the current bounds from state', () => {
      setup({}, { yearMin: 1900, yearMax: 1950 });

      expect(screen.getByTestId('catalog-filter-year-min')).toHaveValue('1900');
      expect(screen.getByTestId('catalog-filter-year-max')).toHaveValue('1950');
    });

    it('is empty when no bounds are set', () => {
      setup();

      expect(screen.getByTestId('catalog-filter-year-min')).toHaveValue('');
      expect(screen.getByTestId('catalog-filter-year-max')).toHaveValue('');
    });

    it('applies a typed year only after 300 ms of no typing', () => {
      vi.useFakeTimers();
      const { onChange } = setup();

      fireEvent.change(screen.getByTestId('catalog-filter-year-min'), { target: { value: '1990' } });
      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ yearMin: 1990 });
    });

    it('restarts the timer on each keystroke and applies the latest text once', () => {
      vi.useFakeTimers();
      const { onChange } = setup();
      const input = screen.getByTestId('catalog-filter-year-min');

      fireEvent.change(input, { target: { value: '19' } });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      fireEvent.change(input, { target: { value: '1950' } });
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(onChange).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(100);
      });
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ yearMin: 1950 });
    });

    it('applies the max bound under yearMax', () => {
      vi.useFakeTimers();
      const { onChange } = setup();

      fireEvent.change(screen.getByTestId('catalog-filter-year-max'), { target: { value: '2001' } });
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onChange).toHaveBeenCalledWith({ yearMax: 2001 });
    });

    it('applies immediately on blur and the cancelled timer does not fire again', () => {
      vi.useFakeTimers();
      const { onChange } = setup();
      const input = screen.getByTestId('catalog-filter-year-min');

      fireEvent.change(input, { target: { value: '1990' } });
      fireEvent.blur(input);
      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ yearMin: 1990 });

      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('applies immediately on Enter', () => {
      vi.useFakeTimers();
      const { onChange } = setup();
      const input = screen.getByTestId('catalog-filter-year-max');

      fireEvent.change(input, { target: { value: '1975' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      expect(onChange).toHaveBeenCalledWith({ yearMax: 1975 });
    });

    it.each(['abc', '0', '10000'])('ignores %j when no bound was set (no onChange call)', (text) => {
      vi.useFakeTimers();
      const { onChange } = setup();
      const input = screen.getByTestId('catalog-filter-year-min');

      fireEvent.change(input, { target: { value: text } });
      fireEvent.blur(input);
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('clears an existing bound with { yearMin: undefined } when the text becomes invalid', () => {
      vi.useFakeTimers();
      const { onChange } = setup({}, { yearMin: 1990 });
      const input = screen.getByTestId('catalog-filter-year-min');

      fireEvent.change(input, { target: { value: 'abc' } });
      fireEvent.blur(input);

      expect(onChange).toHaveBeenCalledTimes(1);
      expect(onChange).toHaveBeenCalledWith({ yearMin: undefined });
    });

    it('does not call onChange when the parsed year equals the current bound', () => {
      vi.useFakeTimers();
      const { onChange } = setup({}, { yearMin: 1990 });
      const input = screen.getByTestId('catalog-filter-year-min');

      fireEvent.change(input, { target: { value: '1990' } });
      fireEvent.blur(input);
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onChange).not.toHaveBeenCalled();
    });

    it('re-syncs the text when the bound changes from outside (Clear all, URL)', () => {
      const { rerender, props } = setup({}, { yearMin: 1990, yearMax: 2000 });
      expect(screen.getByTestId('catalog-filter-year-min')).toHaveValue('1990');

      rerender(<CatalogFilterSidebar {...props} state={{ ...props.state, yearMin: undefined, yearMax: 1800 }} />);

      expect(screen.getByTestId('catalog-filter-year-min')).toHaveValue('');
      expect(screen.getByTestId('catalog-filter-year-max')).toHaveValue('1800');
    });

    it('does not fire a pending timer after unmount', () => {
      vi.useFakeTimers();
      const { onChange, unmount } = setup();

      fireEvent.change(screen.getByTestId('catalog-filter-year-min'), { target: { value: '1990' } });
      unmount();
      act(() => {
        vi.advanceTimersByTime(300);
      });

      expect(onChange).not.toHaveBeenCalled();
    });
  });

  describe('show (criteria #8, #9)', () => {
    it('ticking Key dates only calls onChange({ keyDateOnly: true })', async () => {
      const user = userEvent.setup();
      const { onChange } = setup();

      await user.click(screen.getByTestId('catalog-filter-key-date'));

      expect(onChange).toHaveBeenCalledWith({ keyDateOnly: true });
    });

    it('reflects keyDateOnly from state and unticking calls onChange({ keyDateOnly: false })', async () => {
      const user = userEvent.setup();
      const { onChange } = setup({}, { keyDateOnly: true });
      expect(screen.getByTestId('catalog-filter-key-date')).toBeChecked();

      await user.click(screen.getByTestId('catalog-filter-key-date'));

      expect(onChange).toHaveBeenCalledWith({ keyDateOnly: false });
    });

    it('does not render Hide coins I own when logged out', () => {
      setup({ isLoggedIn: false });

      expect(screen.queryByTestId('catalog-filter-hide-owned')).not.toBeInTheDocument();
    });

    it('renders Hide coins I own when logged in and ticking calls onChange({ hideOwned: true })', async () => {
      const user = userEvent.setup();
      const { onChange } = setup({ isLoggedIn: true });

      await user.click(screen.getByTestId('catalog-filter-hide-owned'));

      expect(onChange).toHaveBeenCalledWith({ hideOwned: true });
    });

    it('reflects hideOwned from state', () => {
      setup({ isLoggedIn: true }, { hideOwned: true });

      expect(screen.getByTestId('catalog-filter-hide-owned')).toBeChecked();
    });
  });

  describe('clear all and heading (criterion #8)', () => {
    it('Clear all calls onClearAll', async () => {
      const user = userEvent.setup();
      const { onClearAll, onChange } = setup({}, { country: 'Ukraine' });

      await user.click(screen.getByTestId('catalog-clear-all'));

      expect(onClearAll).toHaveBeenCalledTimes(1);
      expect(onChange).not.toHaveBeenCalled();
    });

    it('shows the Filters heading by default', () => {
      setup();

      expect(screen.getByRole('heading', { name: 'Filters' })).toBeInTheDocument();
    });

    it('hides the heading when showHeading is false, but keeps Clear all', () => {
      setup({ showHeading: false });

      expect(screen.queryByRole('heading', { name: 'Filters' })).not.toBeInTheDocument();
      expect(screen.getByTestId('catalog-clear-all')).toBeInTheDocument();
    });
  });
});
