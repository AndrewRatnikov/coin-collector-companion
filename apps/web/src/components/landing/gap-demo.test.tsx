/**
 * Tests for: GapDemo (variants A and B, filter, auto-switch, reduced motion) and the variant-B flow through LandingHero
 * Contract source: runs/run_20261117_063301/plan.md § Interface Contract → Component: GapDemo, Component: LandingHero
 * Covers criteria: #8, #11, #12 (from prd.md)
 *
 * matchMedia is absent in jsdom (useMediaQuery then reads false). The reduced-motion tests install a mock
 * that answers by query, so only `prefers-reduced-motion` is true there.
 *
 * CONTRACT_GAPs: none
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { DEMO_AUTO_SWITCH_MS, GapDemo, type GapDemoProps } from '@/components/landing/gap-demo';
import { LandingHero } from '@/components/landing/landing-hero';
import { fill } from '@/lib/fill-template';
import en from '@/lib/i18n/locales/en';
import { LINCOLN_SAMPLE_MOBILE_SLOTS, LINCOLN_SAMPLE_SLOTS } from '@/lib/landing/lincoln-sample';

function installMatchMedia(reduced: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? reduced : false,
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

function renderDemo(over: Partial<GapDemoProps> = {}) {
  const props: GapDemoProps = {
    slots: LINCOLN_SAMPLE_SLOTS,
    setCoinCount: 142,
    fullChecklistHref: '/sets/canonical',
    ...over,
  };
  const view = render(<GapDemo {...props} />);
  return { ...view, props };
}

function advance(ms: number) {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
}

function cardFor(coinId: string): HTMLElement {
  const card = screen.getAllByTestId('coin-card').find((el) => el.getAttribute('data-coin-id') === coinId);
  if (!card) throw new Error(`no card for ${coinId}`);
  return card;
}

function withOwned(ids: string[]) {
  return LINCOLN_SAMPLE_SLOTS.map((slot) => (ids.includes(slot.id) ? { ...slot, owned: true } : slot));
}

describe('GapDemo: variant A (read-only, default)', () => {
  it('shows the sample numbers: 16 of 24 owned, 67%, a progressbar and the All/Missing counts', () => {
    renderDemo();

    expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'all');
    expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('16 of 24 owned');
    expect(screen.getByTestId('gap-demo-percent')).toHaveTextContent('67%');
    const progress = screen.getByTestId('gap-demo-progress');
    expect(progress).toHaveAttribute('role', 'progressbar');
    expect(progress).toHaveAttribute('aria-label', en['landing.progressLabel']);
    expect(Number(progress.getAttribute('aria-valuenow'))).toBeGreaterThan(0);
    expect(screen.getByTestId('gap-demo-filter-all')).toHaveTextContent(/All\s*24/);
    expect(screen.getByTestId('gap-demo-filter-all')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('gap-demo-filter-missing')).toHaveTextContent(/Missing\s*8/);
    expect(screen.getByTestId('gap-demo-filter-missing')).toHaveAttribute('aria-pressed', 'false');
  });

  it('computes the numbers from the slots it is given', () => {
    renderDemo({ slots: LINCOLN_SAMPLE_MOBILE_SLOTS });

    expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('8 of 12 owned');
    expect(screen.getByTestId('gap-demo-percent')).toHaveTextContent('67%');
    expect(screen.getByTestId('gap-demo-filter-all')).toHaveTextContent(/All\s*12/);
    expect(screen.getByTestId('gap-demo-filter-missing')).toHaveTextContent(/Missing\s*4/);
    expect(screen.getAllByTestId('coin-card')).toHaveLength(12);
  });

  it('renders 24 read-only cards with a check, no buttons and no links inside any card', () => {
    renderDemo();

    const cards = screen.getAllByTestId('coin-card');
    expect(cards).toHaveLength(24);
    for (const card of cards) {
      expect(within(card).getByTestId('coin-card-check')).toHaveAttribute('aria-hidden', 'true');
      expect(within(card).queryAllByRole('button')).toHaveLength(0);
      expect(within(card).queryAllByRole('link')).toHaveLength(0);
    }
    expect(screen.queryByTestId('status-toggle')).not.toBeInTheDocument();
    expect(screen.queryByTestId('coin-card-link')).not.toBeInTheDocument();
  });

  it('titles cards by collector notation and shows the status labels from the landing area', () => {
    renderDemo();

    expect(within(cardFor('sample-1909-S-VDB')).getByTestId('coin-card-title')).toHaveTextContent(/^1909-S VDB$/);
    expect(within(cardFor('sample-1909')).getByTestId('coin-card-title')).toHaveTextContent(/^1909$/);
    expect(within(cardFor('sample-1909')).getByTestId('coin-card-status')).toHaveTextContent(
      en['landing.statusOwned'],
    );
    expect(within(cardFor('sample-1909-S-VDB')).getByTestId('coin-card-status')).toHaveTextContent(
      en['landing.statusMissing'],
    );
  });

  it('marks the three key dates with a small key-date badge', () => {
    renderDemo();

    const keyBadges = screen.getAllByTestId('badge').filter((b) => b.getAttribute('data-variant') === 'key-date');
    expect(keyBadges).toHaveLength(3);
    for (const badge of keyBadges) expect(badge).toHaveAttribute('data-size', 'small');
  });

  it('has no try hint and no save note, and tapping a card does nothing', () => {
    renderDemo();

    expect(screen.queryByTestId('gap-demo-try-hint')).not.toBeInTheDocument();
    fireEvent.click(within(cardFor('sample-1909-S-VDB')).getByTestId('coin-card-check'));
    fireEvent.click(cardFor('sample-1909-S-VDB'));

    expect(screen.queryByTestId('gap-demo-save-note')).not.toBeInTheDocument();
    expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('16 of 24 owned');
  });

  it('groups the cards by year with "{owned} of {total}" summaries', () => {
    renderDemo();

    const groups = screen.getAllByTestId('gap-demo-group');
    expect(groups.map((g) => g.getAttribute('data-year'))).toEqual([
      '1909',
      '1910',
      '1911',
      '1912',
      '1913',
      '1914',
      '1915',
      '1916',
    ]);
    const summaryOf = (year: string) =>
      within(groups.find((g) => g.getAttribute('data-year') === year) as HTMLElement).getByTestId(
        'gap-demo-group-summary',
      );
    expect(summaryOf('1909')).toHaveTextContent('2 of 4');
    expect(summaryOf('1910')).toHaveTextContent('1 of 2');
    expect(summaryOf('1911')).toHaveTextContent('3 of 3');
    expect(summaryOf('1914')).toHaveTextContent('1 of 3');
    expect(groups[0]).toHaveAttribute('aria-label', '1909');
  });

  it('writes the subtitle with shown and total, and a short one with the year range when compact', () => {
    const { unmount } = renderDemo({ setCoinCount: 142 });
    expect(screen.getByTestId('gap-demo-subtitle')).toHaveTextContent(
      fill(en['landing.demoSubtitle'], { shown: 24, total: 142 }),
    );
    unmount();

    const other = renderDemo({ setCoinCount: 150 });
    expect(screen.getByTestId('gap-demo-subtitle')).toHaveTextContent(
      fill(en['landing.demoSubtitle'], { shown: 24, total: 150 }),
    );
    other.unmount();

    renderDemo({ compact: true, slots: LINCOLN_SAMPLE_MOBILE_SLOTS });
    expect(screen.getByTestId('gap-demo-subtitle')).toHaveTextContent(
      fill(en['landing.demoSubtitleShort'], { from: 1909, to: 1912 }),
    );
    expect(screen.getByText(en['landing.sampleLabelShort'])).toBeInTheDocument();
  });

  it('shows the sample label, the Sample badge, the set heading and the foot line', () => {
    renderDemo();

    expect(screen.getByText(en['landing.sampleLabel'])).toBeInTheDocument();
    expect(screen.getByText(en['landing.sampleBadge'])).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Lincoln Wheat Cents' })).toBeInTheDocument();
    expect(screen.getByText(fill(en['landing.demoFoot'], { from: 1909, to: 1916 }))).toBeInTheDocument();
  });

  it('links to the full checklist with the given href', () => {
    const { unmount } = renderDemo({ fullChecklistHref: '/sets/canonical/abc' });
    const link = screen.getByTestId('gap-demo-full-link');
    expect(link).toHaveAttribute('href', '/sets/canonical/abc');
    expect(link).toHaveTextContent(en['landing.seeFull']);
    unmount();

    renderDemo({ fullChecklistHref: '/sets/canonical' });
    expect(screen.getByTestId('gap-demo-full-link')).toHaveAttribute('href', '/sets/canonical');
  });

  it('keeps an always-present polite status note, empty at first', () => {
    renderDemo();

    const note = screen.getByTestId('gap-demo-note');
    expect(note).toHaveAttribute('role', 'status');
    expect(note).toHaveAttribute('aria-live', 'polite');
    expect(note.textContent?.trim()).toBe('');
  });
});

describe('GapDemo: the All / Missing control', () => {
  it('shows only the missing coins and their years after clicking Missing', () => {
    renderDemo();

    fireEvent.click(screen.getByTestId('gap-demo-filter-missing'));

    expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'missing');
    expect(screen.getByTestId('gap-demo-filter-missing')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('gap-demo-filter-all')).toHaveAttribute('aria-pressed', 'false');
    const cards = screen.getAllByTestId('coin-card');
    expect(cards).toHaveLength(8);
    for (const card of cards) expect(card).toHaveAttribute('data-state', 'missing');
    expect(screen.getAllByTestId('gap-demo-group').map((g) => g.getAttribute('data-year'))).toEqual([
      '1909',
      '1910',
      '1912',
      '1914',
      '1915',
      '1916',
    ]);
    expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('16 of 24 owned');
  });

  it('shows the 4 missing coins of the mobile slice', () => {
    renderDemo({ slots: LINCOLN_SAMPLE_MOBILE_SLOTS });

    fireEvent.click(screen.getByTestId('gap-demo-filter-missing'));

    expect(screen.getAllByTestId('coin-card')).toHaveLength(4);
    expect(screen.getAllByTestId('gap-demo-group')).toHaveLength(3);
  });

  it('goes back to all coins when All is clicked', () => {
    renderDemo();
    fireEvent.click(screen.getByTestId('gap-demo-filter-missing'));

    fireEvent.click(screen.getByTestId('gap-demo-filter-all'));

    expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'all');
    expect(screen.getAllByTestId('coin-card')).toHaveLength(24);
  });
});

describe('GapDemo: auto-switch to Missing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(window, 'matchMedia');
  });

  it('switches after 2.5 s, shows the auto note, and never switches back by itself', () => {
    expect(DEMO_AUTO_SWITCH_MS).toBe(2500);
    renderDemo();

    advance(2499);
    expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'all');
    expect(screen.getByTestId('gap-demo-note').textContent?.trim()).toBe('');
    advance(1);

    expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'missing');
    expect(screen.getByTestId('gap-demo-note')).toHaveTextContent(en['landing.autoNote']);
    expect(screen.getAllByTestId('coin-card')).toHaveLength(8);
    advance(30000);
    expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'missing');
  });

  it('any filter click cancels the timer: All clicked at 1 s stays All after 10 s', () => {
    renderDemo();
    advance(1000);

    fireEvent.click(screen.getByTestId('gap-demo-filter-all'));
    advance(10000);

    expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'all');
    expect(screen.getByTestId('gap-demo-note').textContent?.trim()).toBe('');
  });

  it('a manual Missing click shows no auto note', () => {
    renderDemo();
    advance(500);

    fireEvent.click(screen.getByTestId('gap-demo-filter-missing'));
    advance(10000);

    expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'missing');
    expect(screen.getByTestId('gap-demo-note').textContent?.trim()).toBe('');
  });

  it('clicking All after the auto-switch clears the note and stays on All', () => {
    renderDemo();
    advance(2500);
    expect(screen.getByTestId('gap-demo-note')).toHaveTextContent(en['landing.autoNote']);

    fireEvent.click(screen.getByTestId('gap-demo-filter-all'));
    advance(10000);

    expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'all');
    expect(screen.getByTestId('gap-demo-note')).not.toHaveTextContent(en['landing.autoNote']);
  });

  it('leaves no timer behind after unmount', () => {
    const { unmount } = renderDemo();

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });

  it('never auto-switches under prefers-reduced-motion and shows the tap note instead', () => {
    installMatchMedia(true);
    renderDemo();

    advance(30000);

    expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'all');
    expect(screen.getByTestId('gap-demo-note')).toHaveTextContent(en['landing.tapNote']);
    expect(screen.getAllByTestId('coin-card')).toHaveLength(24);
  });

  it('drops the tap note once the visitor clicks Missing under reduced motion', () => {
    installMatchMedia(true);
    renderDemo();

    fireEvent.click(screen.getByTestId('gap-demo-filter-missing'));

    expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'missing');
    expect(screen.getByTestId('gap-demo-note')).not.toHaveTextContent(en['landing.tapNote']);
  });

  it('still auto-switches when matchMedia exists and reduced motion is off', () => {
    installMatchMedia(false);
    renderDemo();

    advance(2500);

    expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'missing');
  });
});

describe('GapDemo: variant B (interactive)', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('puts a StatusToggle on every card, no read-only check, and shows the try hint', () => {
    renderDemo({ interactive: true });

    const cards = screen.getAllByTestId('coin-card');
    expect(cards).toHaveLength(24);
    for (const card of cards) {
      expect(within(card).getByTestId('status-toggle')).toHaveAttribute('aria-pressed');
      expect(within(card).queryByTestId('coin-card-check')).not.toBeInTheDocument();
      expect(within(card).queryAllByRole('link')).toHaveLength(0);
    }
    expect(screen.getByTestId('gap-demo-try-hint')).toHaveTextContent(en['landing.tryHint']);
  });

  it('labels the toggles with markOwned for a missing coin and markMissing for an owned one', () => {
    renderDemo({ interactive: true });

    const missing = within(cardFor('sample-1909-S-VDB')).getByTestId('status-toggle');
    expect(missing).toHaveAttribute('aria-pressed', 'false');
    expect(missing).toHaveAccessibleName(fill(en['landing.markOwned'], { coin: '1909-S VDB' }));
    const owned = within(cardFor('sample-1909')).getByTestId('status-toggle');
    expect(owned).toHaveAttribute('aria-pressed', 'true');
    expect(owned).toHaveAccessibleName(fill(en['landing.markMissing'], { coin: '1909' }));
  });

  it('calls onToggle with the coin id and shows the save note with a signup link after the first tap', () => {
    const onToggle = vi.fn();
    renderDemo({ interactive: true, onToggle });
    expect(screen.queryByTestId('gap-demo-save-note')).not.toBeInTheDocument();

    fireEvent.click(within(cardFor('sample-1909-S-VDB')).getByTestId('status-toggle'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('sample-1909-S-VDB');
    const note = screen.getByTestId('gap-demo-save-note');
    expect(note).toHaveTextContent(en['landing.saveNote']);
    expect(within(note).getByTestId('gap-demo-save-link')).toHaveAttribute('href', '/signup');
  });

  it('reports a different coin id for a different card', () => {
    const onToggle = vi.fn();
    renderDemo({ interactive: true, onToggle });

    fireEvent.click(within(cardFor('sample-1914-D')).getByTestId('status-toggle'));

    expect(onToggle).toHaveBeenCalledWith('sample-1914-D');
  });

  it('updates its numbers when the parent passes slots with another coin owned', () => {
    const { rerender, props } = renderDemo({ interactive: true });

    rerender(<GapDemo {...props} slots={withOwned(['sample-1909-S-VDB'])} />);

    expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('17 of 24 owned');
    expect(screen.getByTestId('gap-demo-percent')).toHaveTextContent('71%');
    expect(screen.getByTestId('gap-demo-filter-all')).toHaveTextContent(/All\s*24/);
    expect(screen.getByTestId('gap-demo-filter-missing')).toHaveTextContent(/Missing\s*7/);
  });

  it('moves the progressbar value when ownership changes', () => {
    const { rerender, props } = renderDemo({ interactive: true });
    const before = screen.getByTestId('gap-demo-progress').getAttribute('aria-valuenow');

    rerender(<GapDemo {...props} slots={withOwned(['sample-1909-S-VDB', 'sample-1909-S'])} />);

    expect(screen.getByTestId('gap-demo-progress').getAttribute('aria-valuenow')).not.toBe(before);
  });

  it('drops a coin from the Missing view once the parent marks it owned', () => {
    const { rerender, props } = renderDemo({ interactive: true });
    fireEvent.click(screen.getByTestId('gap-demo-filter-missing'));
    expect(screen.getAllByTestId('coin-card')).toHaveLength(8);

    rerender(<GapDemo {...props} slots={withOwned(['sample-1910-S'])} />);

    expect(screen.getAllByTestId('coin-card')).toHaveLength(7);
    expect(screen.getAllByTestId('gap-demo-group').map((g) => g.getAttribute('data-year'))).not.toContain('1910');
  });

  it('counts a toggle as an interaction: no auto-switch afterwards', () => {
    vi.useFakeTimers();
    renderDemo({ interactive: true, onToggle: vi.fn() });
    advance(1000);

    fireEvent.click(within(cardFor('sample-1909-S-VDB')).getByTestId('status-toggle'));
    advance(10000);

    expect(screen.getByTestId('gap-demo')).toHaveAttribute('data-filter', 'all');
  });
});

describe('LandingHero with interactive: variant B end to end, local state only', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function renderHero() {
    return render(<LandingHero interactive setCoinCount={142} fullChecklistHref="/sets/canonical" />);
  }

  function toggleFor(label: string) {
    return screen.getByRole('button', { name: fill(en['landing.markOwned'], { coin: label }) });
  }

  it('is read-only without the interactive prop', () => {
    render(<LandingHero setCoinCount={142} fullChecklistHref="/sets/canonical" />);

    expect(screen.queryByTestId('status-toggle')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('coin-card-check')).toHaveLength(24);
  });

  it('marking 1910-S owned raises the numbers, drops it from the want list and shows the save note', () => {
    renderHero();
    expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('16 of 24 owned');
    expect(screen.getByTestId('want-list-count')).toHaveTextContent('8 coins');
    expect(screen.getAllByTestId('want-list-row')).toHaveLength(6);

    fireEvent.click(toggleFor('1910-S'));

    expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('17 of 24 owned');
    expect(screen.getByTestId('gap-demo-percent')).toHaveTextContent('71%');
    expect(screen.getByTestId('want-list-count')).toHaveTextContent('7 coins');
    const rows = screen.getAllByTestId('want-list-row');
    expect(rows).toHaveLength(5);
    expect(rows.map((r) => r.getAttribute('data-year'))).not.toContain('1910');
    expect(screen.getByTestId('gap-demo-save-note')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('removes only the toggled mint from a year that still has other gaps', () => {
    renderHero();
    const row1914 = () =>
      screen.getAllByTestId('want-list-row').find((r) => r.getAttribute('data-year') === '1914') as HTMLElement;
    expect(within(row1914()).getByTestId('want-list-mints')).toHaveTextContent('D ★ · S');

    fireEvent.click(toggleFor('1914-D'));

    expect(within(row1914()).getByTestId('want-list-mints')).toHaveTextContent(/^S$/);
    expect(screen.getByTestId('want-list-count')).toHaveTextContent('7 coins');
  });

  it('toggles back to missing on a second tap', () => {
    renderHero();
    fireEvent.click(toggleFor('1910-S'));

    fireEvent.click(screen.getByRole('button', { name: fill(en['landing.markMissing'], { coin: '1910-S' }) }));

    expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('16 of 24 owned');
    expect(screen.getByTestId('want-list-count')).toHaveTextContent('8 coins');
    expect(screen.getAllByTestId('want-list-row')).toHaveLength(6);
  });

  it('shows the empty want list and 100% once every missing coin is marked owned, without any request', () => {
    renderHero();

    for (let i = 0; i < 8; i++) {
      const next = screen
        .getAllByTestId('status-toggle')
        .find((button) => button.getAttribute('aria-pressed') === 'false');
      if (!next) throw new Error('expected a missing coin');
      fireEvent.click(next);
    }

    expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('24 of 24 owned');
    expect(screen.getByTestId('gap-demo-percent')).toHaveTextContent('100%');
    expect(screen.queryAllByTestId('want-list-row')).toHaveLength(0);
    expect(screen.getByTestId('want-list-empty')).toHaveTextContent(en['landing.wantEmpty']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('works on the 12-coin mobile slice too', () => {
    render(<LandingHero interactive compact setCoinCount={142} fullChecklistHref="/sets/canonical" />);
    expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('8 of 12 owned');

    fireEvent.click(toggleFor('1912-S'));

    expect(screen.getByTestId('gap-demo-owned')).toHaveTextContent('9 of 12 owned');
    expect(screen.getByTestId('gap-demo-percent')).toHaveTextContent('75%');
    expect(screen.getByTestId('want-list-count')).toHaveTextContent('3 coins');
  });
});
