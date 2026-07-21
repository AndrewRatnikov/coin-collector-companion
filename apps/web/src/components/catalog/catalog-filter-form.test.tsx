/**
 * Tests for: CatalogFilterForm
 * Contract source: runs/run_20260721_171115/plan.md § Interface Contract → Component: CatalogFilterForm (CREATE)
 * Covers criteria: #4, #10 (from prd.md)
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CatalogFilterForm from '@/components/catalog/catalog-filter-form';

describe('CatalogFilterForm', () => {
  describe('rendering', () => {
    it('renders the form and every field using the given testIdPrefix', () => {
      render(<CatalogFilterForm testIdPrefix="catalog" onSubmit={vi.fn()} />);

      expect(screen.getByTestId('catalog-filter-form')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-country')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-denomination')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-name')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-year-min')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-year-max')).toBeInTheDocument();
      expect(screen.getByTestId('catalog-filter-submit')).toBeInTheDocument();
    });
  });

  describe('criterion 4/10: testIdPrefix parameterization avoids collisions when mounted twice', () => {
    it('uses a distinct set of testids for a different prefix, with no overlap', () => {
      const { unmount } = render(<CatalogFilterForm testIdPrefix="set-editor-add-coins" onSubmit={vi.fn()} />);

      expect(screen.getByTestId('set-editor-add-coins-filter-form')).toBeInTheDocument();
      expect(screen.getByTestId('set-editor-add-coins-filter-country')).toBeInTheDocument();
      expect(screen.getByTestId('set-editor-add-coins-filter-submit')).toBeInTheDocument();
      expect(screen.queryByTestId('catalog-filter-form')).not.toBeInTheDocument();
      unmount();
    });
  });

  describe('criterion 4/10: onSubmit conversion', () => {
    it('calls onSubmit with trimmed string fields and numeric years, omitting empty fields as undefined', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<CatalogFilterForm testIdPrefix="catalog" onSubmit={onSubmit} />);

      await user.type(screen.getByTestId('catalog-filter-country'), 'USA');
      await user.type(screen.getByTestId('catalog-filter-year-min'), '1909');
      await user.click(screen.getByTestId('catalog-filter-submit'));

      expect(onSubmit).toHaveBeenCalledTimes(1);
      const values = onSubmit.mock.calls[0][0];
      expect(values.country).toBe('USA');
      expect(values.denomination).toBeUndefined();
      expect(values.name).toBeUndefined();
      expect(values.yearMin).toBe(1909);
      expect(values.yearMax).toBeUndefined();
    });

    it('calls onSubmit with every field undefined when the form is submitted empty', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();
      render(<CatalogFilterForm testIdPrefix="catalog" onSubmit={onSubmit} />);

      await user.click(screen.getByTestId('catalog-filter-submit'));

      expect(onSubmit).toHaveBeenCalledWith({
        country: undefined,
        denomination: undefined,
        name: undefined,
        yearMin: undefined,
        yearMax: undefined,
      });
    });
  });
});
