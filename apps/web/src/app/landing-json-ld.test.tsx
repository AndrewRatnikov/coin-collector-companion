/**
 * Tests for: Home renders one WebSite JSON-LD block on the landing branch only (apps/web/src/app/page.tsx)
 * Contract source: runs/run_20261127_065505/plan.md § Interface Contract → Page: Home (landing), MODIFY
 * Covers criteria: #12 (from prd.md)
 *
 * Mocks the same modules as app/page.test.tsx. matchMedia is stubbed for the wide viewport.
 *
 * CONTRACT_GAPs: none
 */

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '@/app/page';
import { setStoredToken } from '@/lib/auth-token';
import { useCanonicalSets } from '@/lib/hooks/use-canonical-sets';
import { useCatalog } from '@/lib/hooks/use-catalog';
import { usePublicSets } from '@/lib/hooks/use-public-sets';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));
vi.mock('@/lib/hooks/use-catalog', () => ({ useCatalog: vi.fn() }));
vi.mock('@/lib/hooks/use-canonical-sets', () => ({ useCanonicalSets: vi.fn() }));
vi.mock('@/lib/hooks/use-public-sets', () => ({ usePublicSets: vi.fn() }));

function idleQuery() {
  return { data: undefined, isLoading: false, isError: false, refetch: vi.fn() };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.mocked(useCatalog).mockReturnValue(idleQuery() as unknown as ReturnType<typeof useCatalog>);
  vi.mocked(useCanonicalSets).mockReturnValue(idleQuery() as unknown as ReturnType<typeof useCanonicalSets>);
  vi.mocked(usePublicSets).mockReturnValue(idleQuery() as unknown as ReturnType<typeof usePublicSets>);
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => true,
    }),
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  Reflect.deleteProperty(window, 'matchMedia');
});

describe('landing JSON-LD', () => {
  it('renders exactly one WebSite block inside home-page', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://site.example');
    render(<Home />);
    await waitFor(() => {
      expect(screen.getByTestId('home-page')).toBeInTheDocument();
    });

    const blocks = screen.getAllByTestId('website-json-ld');
    expect(blocks).toHaveLength(1);
    expect(screen.getByTestId('home-page')).toContainElement(blocks[0]);
    const data = JSON.parse(blocks[0].innerHTML);
    expect(data['@type']).toBe('WebSite');
    expect(data.url).toBe('https://site.example/');
    expect(data).not.toHaveProperty('potentialAction');
  });

  it('renders no block while redirecting a signed-in visitor', async () => {
    setStoredToken('tok-abc');
    render(<Home />);
    expect(await screen.findByTestId('home-redirecting')).toBeInTheDocument();
    expect(screen.queryByTestId('website-json-ld')).not.toBeInTheDocument();
  });
});
