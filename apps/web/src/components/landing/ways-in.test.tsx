/**
 * Tests for: WaysIn
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Component: WaysIn
 * Covers criteria: #16 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { WaysIn, type WaysInProps } from '@/components/landing/ways-in';
import en from '@/lib/i18n/locales/en';

function renderWays(over: Partial<WaysInProps> = {}) {
  const props: WaysInProps = {
    catalogCount: 142,
    checklistCount: 5,
    publicSetCount: 3,
    isError: false,
    showWaking: false,
    onRetry: vi.fn(),
    ...over,
  };
  return { ...render(<WaysIn {...props} />), props };
}

const catalogLink = () => screen.getByTestId('home-catalog-link');
const canonicalLink = () => screen.getByTestId('home-canonical-link');
const publicLink = () => screen.getByTestId('home-public-link');

describe('WaysIn: structure', () => {
  it('renders the section with an h2 and three links to the existing routes', () => {
    renderWays();

    const root = screen.getByTestId('landing-ways-in');
    expect(within(root).getByRole('heading', { level: 2, name: en['landing.waysHeading'] })).toBeInTheDocument();
    expect(catalogLink()).toHaveAttribute('href', '/catalog');
    expect(canonicalLink()).toHaveAttribute('href', '/sets/canonical');
    expect(publicLink()).toHaveAttribute('href', '/sets/public');
  });

  it('gives each card its title and body', () => {
    renderWays();

    expect(catalogLink()).toHaveTextContent(en['landing.wayCatalogTitle']);
    expect(catalogLink()).toHaveTextContent(en['landing.wayCatalogBody']);
    expect(canonicalLink()).toHaveTextContent(en['landing.wayChecklistsTitle']);
    expect(canonicalLink()).toHaveTextContent(en['landing.wayChecklistsBody']);
    expect(publicLink()).toHaveTextContent(en['landing.wayCollectorsTitle']);
    expect(publicLink()).toHaveTextContent(en['landing.wayCollectorsBody']);
  });
});

describe('WaysIn: counts', () => {
  it('shows each count inside its own link', () => {
    renderWays({ catalogCount: 142, checklistCount: 5, publicSetCount: 3 });

    expect(within(catalogLink()).getByTestId('landing-way-count')).toHaveTextContent('142 coins');
    expect(within(canonicalLink()).getByTestId('landing-way-count')).toHaveTextContent('5 checklists');
    expect(within(publicLink()).getByTestId('landing-way-count')).toHaveTextContent('3 sets');
    expect(screen.queryByTestId('landing-way-count-loading')).not.toBeInTheDocument();
  });

  it('follows different values (not constants)', () => {
    renderWays({ catalogCount: 17, checklistCount: 2, publicSetCount: 87 });

    expect(within(catalogLink()).getByTestId('landing-way-count')).toHaveTextContent('17 coins');
    expect(within(canonicalLink()).getByTestId('landing-way-count')).toHaveTextContent('2 checklists');
    expect(within(publicLink()).getByTestId('landing-way-count')).toHaveTextContent('87 sets');
  });

  it('uses the singular for one checklist and one public set', () => {
    renderWays({ checklistCount: 1, publicSetCount: 1 });

    expect(within(canonicalLink()).getByTestId('landing-way-count')).toHaveTextContent(/^1 checklist$/);
    expect(within(publicLink()).getByTestId('landing-way-count')).toHaveTextContent(/^1 set$/);
  });

  it('reads "None shared yet. Yours could be the first." for zero public sets and never "0 sets"', () => {
    renderWays({ publicSetCount: 0 });

    expect(within(publicLink()).getByTestId('landing-way-count')).toHaveTextContent(
      'None shared yet. Yours could be the first.',
    );
    expect(screen.queryByText(/0 sets/)).not.toBeInTheDocument();
    expect(screen.getByTestId('landing-ways-in')).not.toHaveTextContent('0 sets');
  });

  it('reads "None yet" for zero public sets when compact', () => {
    renderWays({ publicSetCount: 0, compact: true });

    const count = within(publicLink()).getByTestId('landing-way-count');
    expect(count).toHaveTextContent(/^None yet$/);
    expect(count).not.toHaveTextContent('Yours could be the first');
  });

  it('compact does not change a non-zero count', () => {
    renderWays({ publicSetCount: 4, compact: true });

    expect(within(publicLink()).getByTestId('landing-way-count')).toHaveTextContent('4 sets');
  });
});

describe('WaysIn: loading', () => {
  it('shows a labelled skeleton in every card while all counts are null', () => {
    renderWays({ catalogCount: null, checklistCount: null, publicSetCount: null });

    const loading = screen.getAllByTestId('landing-way-count-loading');
    expect(loading).toHaveLength(3);
    for (const el of loading) {
      expect(el).toHaveAttribute('role', 'img');
      expect(el).toHaveAttribute('aria-label', en['landing.loadingCount']);
      expect(within(el).getByTestId('skeleton')).toBeInTheDocument();
    }
    expect(within(catalogLink()).getByTestId('landing-way-count-loading')).toBeInTheDocument();
    expect(within(canonicalLink()).getByTestId('landing-way-count-loading')).toBeInTheDocument();
    expect(within(publicLink()).getByTestId('landing-way-count-loading')).toBeInTheDocument();
    expect(screen.queryByTestId('landing-way-count')).not.toBeInTheDocument();
  });

  it('loads each card independently', () => {
    renderWays({ catalogCount: null, checklistCount: 5, publicSetCount: 3 });

    expect(within(catalogLink()).getByTestId('landing-way-count-loading')).toBeInTheDocument();
    expect(within(catalogLink()).queryByTestId('landing-way-count')).not.toBeInTheDocument();
    expect(within(canonicalLink()).getByTestId('landing-way-count')).toHaveTextContent('5 checklists');
    expect(within(canonicalLink()).queryByTestId('landing-way-count-loading')).not.toBeInTheDocument();
    expect(within(publicLink()).getByTestId('landing-way-count')).toHaveTextContent('3 sets');
  });

  it('keeps the links usable while loading', () => {
    renderWays({ catalogCount: null, checklistCount: null, publicSetCount: null });

    expect(catalogLink()).toHaveAttribute('href', '/catalog');
    expect(catalogLink()).toHaveTextContent(en['landing.wayCatalogTitle']);
  });
});

describe('WaysIn: error', () => {
  it('hides every count and shows the error line with a Retry button', () => {
    renderWays({ isError: true, catalogCount: 142, checklistCount: 5, publicSetCount: null });

    expect(screen.queryByTestId('landing-way-count')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landing-way-count-loading')).not.toBeInTheDocument();
    const error = screen.getByTestId('landing-counts-error');
    expect(error).toHaveAttribute('role', 'status');
    expect(error).toHaveTextContent(en['landing.countsError']);
    expect(screen.getByTestId('landing-counts-retry')).toHaveTextContent('Retry');
    expect(catalogLink()).toBeInTheDocument();
  });

  it('calls onRetry once per click', () => {
    const { props } = renderWays({ isError: true });
    expect(props.onRetry).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('landing-counts-retry'));

    expect(props.onRetry).toHaveBeenCalledTimes(1);
  });

  it('shows no error line when nothing failed', () => {
    renderWays({ isError: false });

    expect(screen.queryByTestId('landing-counts-error')).not.toBeInTheDocument();
    expect(screen.queryByTestId('landing-counts-retry')).not.toBeInTheDocument();
  });
});

describe('WaysIn: server waking notice', () => {
  it('shows the shared notice when showWaking is true', () => {
    renderWays({ showWaking: true, catalogCount: null, checklistCount: null, publicSetCount: null });

    expect(screen.getByTestId('server-waking-notice')).toHaveTextContent(en['common.serverWaking']);
  });

  it('shows nothing when showWaking is false', () => {
    renderWays({ showWaking: false, catalogCount: null });

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
  });

  it('hides the notice when an error is showing, even if showWaking is true', () => {
    renderWays({ showWaking: true, isError: true });

    expect(screen.queryByTestId('server-waking-notice')).not.toBeInTheDocument();
    expect(screen.getByTestId('landing-counts-error')).toBeInTheDocument();
  });
});
