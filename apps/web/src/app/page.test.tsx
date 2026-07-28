/**
 * Tests for: Home
 * Contract source: runs/run_20260728_071525/plan.md § Interface Contract → apps/web/src/app/page.tsx — Home
 * Covers criteria: #3 (from prd.md)
 *
 * This file is new — codebase-survey.md §9.9 confirms no page.test.tsx exists today for
 * the Home page (unlike the other 12 target pages). Home is rewritten from a one-line
 * placeholder into a real page with three live-count link rows, so this test file is
 * created from scratch against plan.md's Interface Contract rather than modifying an
 * existing file.
 *
 * Routes asserted below (/catalog, /sets/canonical, /sets/public) are not re-derived —
 * they are the existing routes those three pages already live at (confirmed in
 * codebase-survey.md §10.2/§10.4/§10.6 and mirrored by SiteNav's own links to the same
 * paths), not new names invented for this file.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from '@/app/page';
import { useCatalog } from '@/lib/hooks/use-catalog';
import { useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { usePublicSets } from '@/lib/hooks/use-public-sets';

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
  return { data: undefined, isLoading: false, isError: false, ...overrides } as ReturnType<typeof useCatalog>;
}

function canonicalSetsResult(overrides: Partial<ReturnType<typeof useCanonicalSets>> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as ReturnType<typeof useCanonicalSets>;
}

function publicSetsResult(overrides: Partial<ReturnType<typeof usePublicSets>> = {}) {
  return { data: undefined, isLoading: false, isError: false, ...overrides } as ReturnType<typeof usePublicSets>;
}

const CANONICAL_SETS = [
  { id: 's1', name: 'Lincoln Wheat Cent Key Dates', description: 'x', source: 'seed-template', templateVersion: 'v1' },
  { id: 's2', name: 'Lincoln Wheat Cents', description: 'y', source: 'seed-template', templateVersion: 'v1' },
  { id: 's3', name: 'Buffalo Nickels', description: 'z', source: 'seed-template', templateVersion: 'v1' },
];

describe('Home', () => {
  beforeEach(() => {
    useCatalogMock.mockReset();
    useCanonicalSetsMock.mockReset();
    usePublicSetsMock.mockReset();
    useCatalogMock.mockReturnValue(catalogResult());
    useCanonicalSetsMock.mockReturnValue(canonicalSetsResult());
    usePublicSetsMock.mockReturnValue(publicSetsResult());
  });

  describe('rendering the copy block', () => {
    it('renders the root, eyebrow, headline, and paragraph with the exact copy from the Interface Contract', () => {
      render(<Home />);

      expect(screen.getByTestId('home-page')).toBeInTheDocument();
      expect(screen.getByTestId('home-eyebrow')).toHaveTextContent('Est. catalogue & personal ledger');
      expect(screen.getByTestId('home-headline')).toHaveTextContent(
        'A quiet place to record what you have — and what you are still looking for.',
      );
      expect(screen.getByTestId('home-paragraph')).toHaveTextContent(
        'Define a set on your own terms, mark the coins you own, and see the gaps that remain. Browsing needs no account.',
      );
    });
  });

  describe('criterion 3: three link rows to catalogue/canonical/public, correctly routed', () => {
    it('renders home-catalog-link pointing at /catalog', () => {
      render(<Home />);

      const link = screen.getByTestId('home-catalog-link');
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toBe('/catalog');
      expect(link).toHaveTextContent('Browse the catalogue');
    });

    it('renders home-canonical-link pointing at /sets/canonical', () => {
      render(<Home />);

      const link = screen.getByTestId('home-canonical-link');
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toBe('/sets/canonical');
      expect(link).toHaveTextContent('Browse canonical sets');
    });

    it('renders home-public-link pointing at /sets/public', () => {
      render(<Home />);

      const link = screen.getByTestId('home-public-link');
      expect(link).toBeInTheDocument();
      expect(link.getAttribute('href')).toBe('/sets/public');
      expect(link).toHaveTextContent("Browse collectors' sets");
    });
  });

  describe('criterion 3: live counts, not mock numbers', () => {
    it('shows the real catalogue total (from useCatalog) and the "coins" unit in the catalog row', () => {
      useCatalogMock.mockReturnValue(catalogResult({ data: { items: [], page: 1, limit: 1, total: 4213 } }));
      render(<Home />);

      const link = screen.getByTestId('home-catalog-link');
      expect(link).toHaveTextContent('4213');
      expect(link).toHaveTextContent('coins');
    });

    it('calls useCatalog with page 1 / limit 1 (cheap total-only fetch, no full page needed)', () => {
      render(<Home />);
      expect(useCatalogMock).toHaveBeenCalledWith({ page: 1, limit: 1 });
    });

    it('shows the real canonical-sets count (from useCanonicalSets().data.length) and the "sets" unit', () => {
      useCanonicalSetsMock.mockReturnValue(canonicalSetsResult({ data: CANONICAL_SETS as never }));
      render(<Home />);

      const link = screen.getByTestId('home-canonical-link');
      expect(link).toHaveTextContent('3');
      expect(link).toHaveTextContent('sets');
    });

    it('shows the real public-sets total (from usePublicSets().data.total) and the "sets" unit', () => {
      usePublicSetsMock.mockReturnValue(publicSetsResult({ data: { items: [], page: 1, limit: 1, total: 87 } }));
      render(<Home />);

      const link = screen.getByTestId('home-public-link');
      expect(link).toHaveTextContent('87');
      expect(link).toHaveTextContent('sets');
    });

    it('calls usePublicSets with page 1 / limit 1 (cheap total-only fetch, no full page needed)', () => {
      render(<Home />);
      expect(usePublicSetsMock).toHaveBeenCalledWith({ page: 1, limit: 1 });
    });

    it('renders the link rows without a numeric count while any of the three queries is still loading (non-blocking, no gate)', () => {
      useCatalogMock.mockReturnValue(catalogResult({ isLoading: true }));
      render(<Home />);

      const link = screen.getByTestId('home-catalog-link');
      expect(link).toHaveTextContent('Browse the catalogue');
      expect(link.textContent).not.toMatch(/\d/);
      // Loading is non-blocking: the page itself and the other rows still render.
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
      expect(screen.getByTestId('home-canonical-link')).toBeInTheDocument();
      expect(screen.getByTestId('home-public-link')).toBeInTheDocument();
    });
  });

  describe('no auth gating', () => {
    it('renders full content synchronously with no stored token', () => {
      localStorage.clear();
      render(<Home />);

      expect(screen.getByTestId('home-page')).toBeInTheDocument();
      expect(screen.getByTestId('home-headline')).toBeInTheDocument();
    });
  });
});
