/**
 * Tests for: Home (signed-out landing page, signed-in redirect)
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Page: Home
 * Covers criteria: #7, #8, #9, #12, #13, #14, #16, #17, #18 (from prd.md)
 *
 * History: runs/run_20260728_071525 created this file for the three link rows; run_20261018_085900 added the
 * signed-in redirect block. run_20261117_063301 rewrites it for the landing page: the old copy block
 * (home-eyebrow / home-headline / home-paragraph) is gone with those test ids, the count tests are carried over
 * onto the new landing-way-count elements, and the signed-in redirect tests are kept as they were.
 *
 * Every matchMedia mock answers by query (`prefers-reduced-motion` and `(max-width: 899px)` independently),
 * otherwise the page would also switch to the 12-coin mobile slice. jsdom has no matchMedia, so the default
 * is the wide viewport with motion allowed.
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Home from '@/app/page';
import { setStoredToken } from '@/lib/auth-token';
import { useCatalog } from '@/lib/hooks/use-catalog';
import { useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { usePublicSets } from '@/lib/hooks/use-public-sets';
import en from '@/lib/i18n/locales/en';

const replaceMock = vi.fn();
const pushMock = vi.fn();
const catalogRefetch = vi.fn();
const canonicalRefetch = vi.fn();
const publicRefetch = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
}));

vi.mock('@/lib/hooks/use-catalog', () => ({
  useCatalog: vi.fn(),
}));

vi.mock('@/lib/hooks/use-canonical-sets', () => ({
  useCanonicalSets: vi.fn(),
}));

vi.mock('@/lib/hooks/use-public-sets', () => ({
  usePublicSets: vi.fn(),
}));

const useCatalogMock = vi.mocked(useCatalog);
const useCanonicalSetsMock = vi.mocked(useCanonicalSets);
const usePublicSetsMock = vi.mocked(usePublicSets);

function catalogResult(overrides: Partial<ReturnType<typeof useCatalog>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: catalogRefetch,
    ...overrides,
  } as unknown as ReturnType<typeof useCatalog>;
}

function canonicalSetsResult(overrides: Partial<ReturnType<typeof useCanonicalSets>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: canonicalRefetch,
    ...overrides,
  } as unknown as ReturnType<typeof useCanonicalSets>;
}

function publicSetsResult(overrides: Partial<ReturnType<typeof usePublicSets>> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    refetch: publicRefetch,
    ...overrides,
  } as unknown as ReturnType<typeof usePublicSets>;
}

function catalogData(total: number) {
  return catalogResult({ data: { items: [], page: 1, limit: 1, total } });
}

function publicData(total: number) {
  return publicSetsResult({ data: { items: [], page: 1, limit: 1, total } });
}

function set(id: string, name: string, coinCount = 10) {
  return { id, name, description: 'x', source: 'seed-template', templateVersion: 'v1', coinCount };
}

const CANONICAL_SETS = [
  set('s1', 'Lincoln Wheat Cent Key Dates', 8),
  set('s2', 'Lincoln Wheat Cents', 150),
  set('s3', 'Ukraine Circulation Coins', 200),
];

function installMatchMedia({ narrow = false, reduced = false }: { narrow?: boolean; reduced?: boolean } = {}) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reduced : query.includes('max-width') ? narrow : false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }),
  });
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

const countOf = (testId: string) => within(screen.getByTestId(testId)).getByTestId('landing-way-count');

describe('Home', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    replaceMock.mockClear();
    pushMock.mockClear();
    catalogRefetch.mockReset();
    canonicalRefetch.mockReset();
    publicRefetch.mockReset();
    useCatalogMock.mockReset();
    useCanonicalSetsMock.mockReset();
    usePublicSetsMock.mockReset();
    useCatalogMock.mockReturnValue(catalogResult());
    useCanonicalSetsMock.mockReturnValue(canonicalSetsResult());
    usePublicSetsMock.mockReturnValue(publicSetsResult());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Reflect.deleteProperty(window, 'matchMedia');
  });

  describe('criterion 8: the signed-out page', () => {
    it('renders the root with exactly one h1 and both calls to action', () => {
      render(<Home />);

      expect(screen.getByTestId('home-page')).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
      expect(screen.getByTestId('landing-headline')).toHaveTextContent('See what you’re still missing.');
      expect(screen.getByTestId('landing-cta-primary')).toHaveAttribute('href', '/signup');
      expect(screen.getByTestId('landing-cta-secondary')).toHaveAttribute('href', '/sets/canonical');
    });

    it('no longer renders the old home copy', () => {
      render(<Home />);

      expect(screen.queryByTestId('home-eyebrow')).not.toBeInTheDocument();
      expect(screen.queryByTestId('home-headline')).not.toBeInTheDocument();
      expect(screen.queryByTestId('home-paragraph')).not.toBeInTheDocument();
    });

    it('renders the hero, points, ways in and coverage sections', () => {
      render(<Home />);

      expect(screen.getByTestId('landing-hero')).toBeInTheDocument();
      expect(screen.getByTestId('landing-points')).toBeInTheDocument();
      expect(screen.getByTestId('landing-ways-in')).toBeInTheDocument();
      expect(screen.getByTestId('landing-coverage')).toBeInTheDocument();
    });

    it('renders full content synchronously with no stored token', () => {
      localStorage.clear();
      render(<Home />);

      expect(screen.getByTestId('home-page')).toBeInTheDocument();
      expect(screen.getByTestId('landing-headline')).toBeInTheDocument();
    });

    it('shows the account-deleted notice first when its flag is set', async () => {
      sessionStorage.setItem('ccc-account-deleted', '1');
      render(<Home />);

      expect(await screen.findByTestId('account-deleted-notice')).toBeInTheDocument();
    });
  });

  describe('criterion 9: the demo never waits on the API', () => {
    it('shows 16 of 24 owned and 67% while all three queries are loading', () => {
      useCatalogMock.mockReturnValue(catalogResult({ isLoading: true }));
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ isLoading: true }));
      usePublicSetsMock.mockReturnValue(publicSetsResult({ isLoading: true }));
      render(<Home />);

      expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('16 of 24 owned');
      expect(screen.getByTestId('gap-demo-percent')).toHaveTextContent('67%');
      expect(screen.getAllByTestId('coin-card')).toHaveLength(24);
    });

    it('shows the same demo when all three queries fail', () => {
      useCatalogMock.mockReturnValue(catalogResult({ isError: true }));
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ isError: true }));
      usePublicSetsMock.mockReturnValue(publicSetsResult({ isError: true }));
      render(<Home />);

      expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('16 of 24 owned');
    });

    it('ships variant A: read-only cards, no buttons inside any card', () => {
      render(<Home />);

      expect(screen.queryByTestId('status-toggle')).not.toBeInTheDocument();
      expect(screen.getAllByTestId('coin-card-check')).toHaveLength(24);
    });

    it('builds the want list with 6 year rows and 8 coins', () => {
      render(<Home />);

      expect(screen.getAllByTestId('want-list-row')).toHaveLength(6);
      expect(screen.getByTestId('want-list-count')).toHaveTextContent('8 coins');
    });

    it('never calls fetch directly', () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      render(<Home />);

      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('criterion 12: auto-switch to Missing', () => {
    it('switches to Missing at 2.5 s and not before', () => {
      vi.useFakeTimers();
      render(<Home />);

      advance(2400);
      expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'all');
      advance(100);

      expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'missing');
      expect(screen.getByTestId('gap-demo-note')).toHaveTextContent(en['landing.autoNote']);
      expect(screen.getAllByTestId('coin-card')).toHaveLength(8);
    });

    it('does not switch under prefers-reduced-motion and shows the tap note', () => {
      installMatchMedia({ reduced: true });
      vi.useFakeTimers();
      render(<Home />);

      advance(10000);

      expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'all');
      expect(screen.getByTestId('gap-demo-note')).toHaveTextContent(en['landing.tapNote']);
      expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('16 of 24 owned');
    });

    it('keeps 24 coins at the wide viewport even when matchMedia exists and motion is allowed', () => {
      installMatchMedia({ narrow: false, reduced: false });
      render(<Home />);

      expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('16 of 24 owned');
    });
  });

  describe('criterion 18: mobile', () => {
    it('uses the 1909-1912 slice under 900px: 8 of 12 owned, 3 want-list rows', () => {
      installMatchMedia({ narrow: true });
      render(<Home />);

      expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('8 of 12 owned');
      expect(screen.getByTestId('gap-demo-percent')).toHaveTextContent('67%');
      expect(screen.getAllByTestId('want-list-row')).toHaveLength(3);
    });

    it('reads "None yet" for zero public sets under 900px', () => {
      installMatchMedia({ narrow: true });
      usePublicSetsMock.mockReturnValue(publicData(0));
      render(<Home />);

      expect(countOf('home-public-link')).toHaveTextContent(/^None yet$/);
    });
  });

  describe('criterion 14: the want list', () => {
    it('lists the mints per year with key dates starred', () => {
      render(<Home />);

      const rows = screen.getAllByTestId('want-list-row');
      expect(rows.map((r) => r.getAttribute('data-year'))).toEqual(['1909', '1910', '1912', '1914', '1915', '1916']);
      expect(within(rows[0]).getByTestId('want-list-mints')).toHaveTextContent('S ★ · S VDB ★');
    });
  });

  describe('criterion 13: full checklist link', () => {
    it('points at the Lincoln Wheat Cents checklist when useCanonicalSets returns it', () => {
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ data: CANONICAL_SETS as never }));
      render(<Home />);

      expect(screen.getByTestId('gap-demo-full-link')).toHaveAttribute('href', '/sets/canonical/s2');
    });

    it('follows the id of the matching set', () => {
      useCanonicalSetsMock.mockReturnValue(
        canonicalSetsResult({ data: [set('other-id', 'Lincoln Wheat Cents')] as never }),
      );
      render(<Home />);

      expect(screen.getByTestId('gap-demo-full-link')).toHaveAttribute('href', '/sets/canonical/other-id');
    });

    it('falls back to /sets/canonical while loading, on error and with no match', () => {
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ isLoading: true }));
      const loading = render(<Home />);
      expect(screen.getByTestId('gap-demo-full-link')).toHaveAttribute('href', '/sets/canonical');
      loading.unmount();

      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ isError: true }));
      const failed = render(<Home />);
      expect(screen.getByTestId('gap-demo-full-link')).toHaveAttribute('href', '/sets/canonical');
      failed.unmount();

      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ data: [set('s1', 'Buffalo Nickels')] as never }));
      render(<Home />);
      expect(screen.getByTestId('gap-demo-full-link')).toHaveAttribute('href', '/sets/canonical');
    });
  });

  describe('criterion 16: ways in', () => {
    it('links the three cards to catalog, canonical sets and public sets', () => {
      render(<Home />);

      expect(screen.getByTestId('home-catalog-link')).toHaveAttribute('href', '/catalog');
      expect(screen.getByTestId('home-canonical-link')).toHaveAttribute('href', '/sets/canonical');
      expect(screen.getByTestId('home-public-link')).toHaveAttribute('href', '/sets/public');
    });

    it('calls the data hooks with the cheap total-only parameters', () => {
      render(<Home />);

      expect(useCatalogMock).toHaveBeenCalledWith({ page: 1, limit: 1 });
      expect(usePublicSetsMock).toHaveBeenCalledWith({ page: 1, limit: 1 });
      expect(useCanonicalSetsMock).toHaveBeenCalled();
    });

    it('shows the real counts: catalog total, canonical length, public total', () => {
      useCatalogMock.mockReturnValue(catalogData(640));
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ data: CANONICAL_SETS as never }));
      usePublicSetsMock.mockReturnValue(publicData(87));
      render(<Home />);

      expect(countOf('home-catalog-link')).toHaveTextContent('640 coins');
      expect(countOf('home-canonical-link')).toHaveTextContent('3 checklists');
      expect(countOf('home-public-link')).toHaveTextContent('87 sets');
    });

    it('shows different counts for different data (derived, not hard-coded)', () => {
      useCatalogMock.mockReturnValue(catalogData(17));
      useCanonicalSetsMock.mockReturnValue(
        canonicalSetsResult({ data: [...CANONICAL_SETS, set('s4', 'Mercury Dimes'), set('s5', 'Morgan Dollars')] as never }),
      );
      usePublicSetsMock.mockReturnValue(publicData(250));
      render(<Home />);

      expect(countOf('home-catalog-link')).toHaveTextContent('17 coins');
      expect(countOf('home-canonical-link')).toHaveTextContent('5 checklists');
      expect(countOf('home-public-link')).toHaveTextContent('250 sets');
    });

    it('shows a count skeleton in each card while its query has no data', () => {
      useCatalogMock.mockReturnValue(catalogResult({ isLoading: true }));
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ isLoading: true }));
      usePublicSetsMock.mockReturnValue(publicSetsResult({ isLoading: true }));
      render(<Home />);

      expect(screen.getAllByTestId('landing-way-count-loading')).toHaveLength(3);
      expect(screen.queryByTestId('landing-way-count')).not.toBeInTheDocument();
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });

    it('reads "None shared yet. Yours could be the first." for zero public sets and never "0 sets"', () => {
      usePublicSetsMock.mockReturnValue(publicData(0));
      render(<Home />);

      expect(countOf('home-public-link')).toHaveTextContent('None shared yet. Yours could be the first.');
      expect(screen.queryByText(/0 sets/)).not.toBeInTheDocument();
    });

    it('shows the error line and no counts when a query fails, and Retry refetches all three', () => {
      useCatalogMock.mockReturnValue(catalogData(640));
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ isError: true }));
      usePublicSetsMock.mockReturnValue(publicData(87));
      render(<Home />);

      expect(screen.getByTestId('landing-counts-error')).toHaveTextContent(en['landing.countsError']);
      expect(screen.queryByTestId('landing-way-count')).not.toBeInTheDocument();
      expect(catalogRefetch).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('landing-counts-retry'));

      expect(catalogRefetch).toHaveBeenCalledTimes(1);
      expect(canonicalRefetch).toHaveBeenCalledTimes(1);
      expect(publicRefetch).toHaveBeenCalledTimes(1);
    });

    it('shows no error line when every query succeeds', () => {
      useCatalogMock.mockReturnValue(catalogData(640));
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ data: CANONICAL_SETS as never }));
      usePublicSetsMock.mockReturnValue(publicData(87));
      render(<Home />);

      expect(screen.queryByTestId('landing-counts-error')).not.toBeInTheDocument();
    });
  });

  describe('criterion 16: waking notice beside the ways-in heading', () => {
    it('is absent at 2.9 s, present at 3 s, and gone once the counts arrive', () => {
      vi.useFakeTimers();
      useCatalogMock.mockReturnValue(catalogResult({ isLoading: true }));
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ isLoading: true }));
      usePublicSetsMock.mockReturnValue(publicSetsResult({ isLoading: true }));
      const view = render(<Home />);

      advance(2900);
      expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
      advance(100);
      expect(screen.getByTestId('server-waking-notice')).toHaveTextContent(en['common.serverWaking']);
      expect(within(screen.getByTestId('landing-ways-in')).getByTestId('server-waking-notice')).toBeInTheDocument();
      expect(screen.getAllByTestId('landing-way-count-loading')).toHaveLength(3);

      useCatalogMock.mockReturnValue(catalogData(640));
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ data: CANONICAL_SETS as never }));
      usePublicSetsMock.mockReturnValue(publicData(87));
      view.rerender(<Home />);

      expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
      expect(countOf('home-catalog-link')).toHaveTextContent('640 coins');
    });

    it('appears when any one of the three queries is still loading at 3 s', () => {
      vi.useFakeTimers();
      useCatalogMock.mockReturnValue(catalogData(640));
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ data: CANONICAL_SETS as never }));
      usePublicSetsMock.mockReturnValue(publicSetsResult({ isLoading: true }));
      render(<Home />);

      advance(3000);

      expect(screen.getByTestId('server-waking-notice')).toBeInTheDocument();
      expect(countOf('home-catalog-link')).toHaveTextContent('640 coins');
    });

    it('never appears when nothing is loading', () => {
      vi.useFakeTimers();
      useCatalogMock.mockReturnValue(catalogData(640));
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ data: CANONICAL_SETS as never }));
      usePublicSetsMock.mockReturnValue(publicData(87));
      render(<Home />);

      advance(10000);

      expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    });

    it('does not show while an error is showing', () => {
      vi.useFakeTimers();
      useCatalogMock.mockReturnValue(catalogResult({ isLoading: true }));
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ isError: true }));
      render(<Home />);

      advance(5000);

      expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
      expect(screen.getByTestId('landing-counts-error')).toBeInTheDocument();
    });
  });

  describe('criterion 17: coverage', () => {
    it('uses the fallbacks while the canonical sets are loading, with no skeleton or waking notice in the section', () => {
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ isLoading: true }));
      render(<Home />);

      expect(screen.getByTestId('landing-coverage-lincoln-meta')).toHaveTextContent('142 coins · 7 key dates');
      expect(screen.getByTestId('landing-coverage-ukraine-meta')).toHaveTextContent(
        '187 circulation · 31 commemoratives',
      );
      expect(within(screen.getByTestId('landing-coverage')).queryByTestId('skeleton')).not.toBeInTheDocument();
    });

    it('uses the real coin counts of the matching templates and falls back per field', () => {
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ data: CANONICAL_SETS as never }));
      render(<Home />);

      expect(screen.getByTestId('landing-coverage-lincoln-meta')).toHaveTextContent('150 coins · 8 key dates');
      expect(screen.getByTestId('landing-coverage-ukraine-meta')).toHaveTextContent(
        '200 circulation · 31 commemoratives',
      );
    });

    it('uses the fallbacks on error', () => {
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ isError: true }));
      render(<Home />);

      expect(screen.getByTestId('landing-coverage-lincoln-meta')).toHaveTextContent('142 coins · 7 key dates');
    });

    it('feeds the set coin count into the demo subtitle', () => {
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ data: CANONICAL_SETS as never }));
      render(<Home />);

      expect(screen.getByTestId('gap-demo-subtitle')).toHaveTextContent('first 24 of 150 coins');
    });
  });

  describe('criterion 7: signed-in redirect to /dashboard', () => {
    it('replaces the route with /dashboard once when a token is stored', async () => {
      setStoredToken('tok-abc');
      render(<Home />);

      await waitFor(() => {
        expect(replaceMock).toHaveBeenCalledWith('/dashboard');
      });
      expect(replaceMock).toHaveBeenCalledTimes(1);
      expect(pushMock).not.toHaveBeenCalled();
    });

    it('renders home-redirecting instead of the landing content while redirecting', async () => {
      setStoredToken('tok-abc');
      render(<Home />);

      expect(await screen.findByTestId('home-redirecting')).toBeInTheDocument();
      expect(screen.queryByTestId('home-page')).not.toBeInTheDocument();
      expect(screen.queryByTestId('landing-headline')).not.toBeInTheDocument();
      expect(screen.queryByTestId('gap-demo')).not.toBeInTheDocument();
    });

    it('does not redirect and shows the landing page when signed out', async () => {
      render(<Home />);

      expect(screen.getByTestId('home-page')).toBeInTheDocument();
      await waitFor(() => {
        expect(screen.getByTestId('home-page')).toBeInTheDocument();
      });
      expect(replaceMock).not.toHaveBeenCalled();
      expect(screen.queryByTestId('home-redirecting')).not.toBeInTheDocument();
    });
  });
});
