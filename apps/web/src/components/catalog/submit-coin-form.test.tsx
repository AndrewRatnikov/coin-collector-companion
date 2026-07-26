/**
 * Tests for: SubmitCoinForm
 * Contract source: runs/run_20260725_140648/plan.md § Interface Contract → Frontend — SubmitCoinForm (CREATE)
 * Covers criteria: #3, #4 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * useSubmitCoin is mocked entirely — no real network call. Field inputs are queried via
 * document.getElementById(id), matching the established FormField convention already used
 * by apps/web/src/app/signup/page.test.tsx (FormField does not forward a data-testid prop).
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SubmitCoinForm from '@/components/catalog/submit-coin-form';
import { useSubmitCoin } from '@/lib/hooks/use-catalog';
import { ApiError } from '@/lib/api-client';

vi.mock('@/lib/hooks/use-catalog', () => ({
  useSubmitCoin: vi.fn(),
}));

const useSubmitCoinMock = vi.mocked(useSubmitCoin);

function mutationMock({ resolvedValue, rejectedValue }: { resolvedValue?: unknown; rejectedValue?: unknown } = {}) {
  const mutate = vi.fn(
    (_vars: unknown, opts?: { onSuccess?: (data: unknown) => void; onError?: (err: unknown) => void }) => {
      if (rejectedValue) opts?.onError?.(rejectedValue);
      else opts?.onSuccess?.(resolvedValue);
    },
  );
  return { mutate, isPending: false } as never;
}

async function fillAndSubmit(overrides: Partial<Record<'country' | 'denomination' | 'name' | 'year' | 'mintMark' | 'variety', string>> = {}) {
  const values = {
    country: 'USA',
    denomination: '1 Cent',
    name: 'Indian Head Cent',
    year: '1900',
    ...overrides,
  };
  const user = userEvent.setup();
  const countryInput = document.getElementById('submit-coin-country') as HTMLInputElement;
  const denominationInput = document.getElementById('submit-coin-denomination') as HTMLInputElement;
  const nameInput = document.getElementById('submit-coin-name') as HTMLInputElement;
  const yearInput = document.getElementById('submit-coin-year') as HTMLInputElement;

  await user.type(countryInput, values.country);
  await user.type(denominationInput, values.denomination);
  await user.type(nameInput, values.name);
  await user.type(yearInput, values.year);
  if (values.mintMark) {
    await user.type(document.getElementById('submit-coin-mint-mark') as HTMLInputElement, values.mintMark);
  }
  if (values.variety) {
    await user.type(document.getElementById('submit-coin-variety') as HTMLInputElement, values.variety);
  }
  await user.click(screen.getByTestId('submit-coin-submit'));
}

describe('SubmitCoinForm', () => {
  beforeEach(() => {
    useSubmitCoinMock.mockReset();
  });

  describe('rendering', () => {
    it('renders the form root, all six inputs, and the submit button', () => {
      useSubmitCoinMock.mockReturnValue(mutationMock());
      render(<SubmitCoinForm onSuccess={vi.fn()} />);

      expect(screen.getByTestId('submit-coin-form')).toBeInTheDocument();
      expect(document.getElementById('submit-coin-country')).toBeInTheDocument();
      expect(document.getElementById('submit-coin-denomination')).toBeInTheDocument();
      expect(document.getElementById('submit-coin-name')).toBeInTheDocument();
      expect(document.getElementById('submit-coin-year')).toBeInTheDocument();
      expect(document.getElementById('submit-coin-mint-mark')).toBeInTheDocument();
      expect(document.getElementById('submit-coin-variety')).toBeInTheDocument();
      expect(screen.getByTestId('submit-coin-submit')).toBeInTheDocument();
    });
  });

  describe('criterion 3: submits via useSubmitCoin with the entered values', () => {
    it('calls mutate with country/denomination/name/year (as a number) when mintMark/variety are left blank', async () => {
      const mutate = vi.fn();
      useSubmitCoinMock.mockReturnValue({ mutate, isPending: false } as never);
      render(<SubmitCoinForm onSuccess={vi.fn()} />);

      await fillAndSubmit();

      expect(mutate).toHaveBeenCalledTimes(1);
      const [payload] = mutate.mock.calls[0];
      expect(payload).toMatchObject({ country: 'USA', denomination: '1 Cent', name: 'Indian Head Cent', year: 1900 });
    });

    it('includes mintMark and variety when provided', async () => {
      const mutate = vi.fn();
      useSubmitCoinMock.mockReturnValue({ mutate, isPending: false } as never);
      render(<SubmitCoinForm onSuccess={vi.fn()} />);

      await fillAndSubmit({ mintMark: 'D', variety: 'Doubled Die' });

      const [payload] = mutate.mock.calls[0];
      expect(payload).toMatchObject({ mintMark: 'D', variety: 'Doubled Die' });
    });

    it('calls onSuccess with the created coin when the mutation succeeds', async () => {
      const created = { id: 'new-1', status: 'pending', country: 'USA' };
      useSubmitCoinMock.mockReturnValue(mutationMock({ resolvedValue: created }));
      const onSuccess = vi.fn();
      render(<SubmitCoinForm onSuccess={onSuccess} />);

      await fillAndSubmit();

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(created);
      });
    });
  });

  describe('criterion 4: dedup/validation errors surface without an unhandled exception', () => {
    it('shows a field-level error for a 400 whose detail matches a known field', async () => {
      useSubmitCoinMock.mockReturnValue(
        mutationMock({ rejectedValue: new ApiError(400, 'year must not be less than 1000', ['year must not be less than 1000']) }),
      );
      render(<SubmitCoinForm onSuccess={vi.fn()} />);

      await fillAndSubmit({ year: '5' });

      await waitFor(() => {
        expect(document.getElementById('submit-coin-year-error')?.textContent).toBe('year must not be less than 1000');
      });
    });

    it('shows a page-level error (submit-coin-form-error) for a 409 conflict, not routed through field errors', async () => {
      useSubmitCoinMock.mockReturnValue(
        mutationMock({
          rejectedValue: new ApiError(409, 'A coin with this natural key already exists', [
            'A coin with this natural key already exists',
          ]),
        }),
      );
      render(<SubmitCoinForm onSuccess={vi.fn()} />);

      await fillAndSubmit();

      await waitFor(() => {
        expect(screen.getByTestId('submit-coin-form-error')).toHaveTextContent(
          'A coin with this natural key already exists',
        );
      });
      expect(document.getElementById('submit-coin-country-error')).not.toBeInTheDocument();
    });

    it('does not call onSuccess when the mutation is rejected', async () => {
      useSubmitCoinMock.mockReturnValue(
        mutationMock({ rejectedValue: new ApiError(409, 'duplicate', ['duplicate']) }),
      );
      const onSuccess = vi.fn();
      render(<SubmitCoinForm onSuccess={onSuccess} />);

      await fillAndSubmit();

      await waitFor(() => {
        expect(screen.getByTestId('submit-coin-form-error')).toBeInTheDocument();
      });
      expect(onSuccess).not.toHaveBeenCalled();
    });
  });
});
