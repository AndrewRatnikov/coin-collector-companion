/**
 * Tests for: SetAlbum (coin cards) and SetViewSwitch components
 * Contract source: runs/run_20261010_083926/plan.md § Interface Contract → Component: SetAlbum
 *                   runs/run_20261011_095624/plan.md § Interface Contract → Component: SetAlbum
 *                   runs/run_20261017_142658/plan.md § Approach §3 and §1 (card text via getCoinName, year label font)
 * Covers criteria: #4, #5, #7, #8, #9, #13, #14, #15, #16, #17, #18 (class hooks), #19, #20, #22, #23, #24
 *                  (run_20261010_083926); #3, #4, #6, #7, #8 (run_20261011_095624: hide-not-dim,
 *                  all-owned message, trimmed legend, visitor status line, image well, focus-within);
 *                  #3, #6 (run_20261017_142658: names per getCoinName, year group label in Plex Mono 20/500)
 *
 * run_20261011_095624 intentionally rewrites: the "explains the new visuals" legend test, the
 * Missing-filter (gapOnly) muting tests (now hide-not-dim), and the visitor year-on-grid expectation.
 *
 * run_20261017_142658 rewrites the card-text expectations (eyebrow, title and secondary line now come
 * from getCoinName: a variety without a series prefix gets the coin's type name as eyebrow, the secondary
 * line is country, denomination and year with already-shown parts left out) and adds the year label font.
 * Every other test is unchanged.
 *
 * CONTRACT_GAPS: none
 */

import { describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { GapSlot } from '@coin-collector/shared';
import { SetAlbum } from '@/components/sets/set-album';
import { SetViewSwitch } from '@/components/sets/set-view-switch';

function slot(
  position: number,
  id: string,
  over: {
    year: number;
    mintMark?: string;
    variety?: string;
    name?: string;
    country?: string;
    denomination?: string;
    owned?: boolean;
    isKeyDate?: boolean;
    imageUrl?: string | null;
  },
): GapSlot {
  return {
    id: `usc-${id}`,
    position,
    owned: over.owned ?? false,
    coin: {
      id: `coin-${id}`,
      country: over.country ?? 'USA',
      denomination: over.denomination ?? 'Cent',
      year: over.year,
      mintMark: over.mintMark ?? '',
      variety: over.variety ?? '',
      name: over.name ?? 'Lincoln Wheat Cent',
      imageUrl: over.imageUrl ?? null,
      imageSource: null,
      imageLicense: null,
      diameterMm: null,
      weightG: null,
      thicknessMm: null,
      material: null,
      mintage: null,
      isKeyDate: over.isKeyDate ?? false,
      status: 'approved',
      submittedAt: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  };
}

// Lincoln page, columns '', D, S; rows 1909, 1931
//   1909: ''  -> plain (owned) + VDB (missing); D -> blank; S -> VDB (owned)
//   1931: ''  -> blank;                          D -> owned; S -> key date (missing)
const L_PLAIN = slot(0, 'plain', { year: 1909, owned: true });
const L_VDB = slot(1, 'vdb', { year: 1909, variety: 'VDB', owned: false });
const L_S_VDB = slot(2, 'svdb', { year: 1909, mintMark: 'S', variety: 'VDB', owned: true });
const L_1931S = slot(3, '1931s', { year: 1931, mintMark: 'S', isKeyDate: true, owned: false });
const L_1931D = slot(4, '1931d', { year: 1931, mintMark: 'D', owned: true });
// Ukrainian page, single '' column
const U_ONE = slot(10, 'u1', {
  year: 2026,
  country: 'Ukraine',
  denomination: '1 Hryvnia',
  name: 'Commemorative',
  variety: 'A very long commemorative variety name that must wrap and never be cut off',
  owned: false,
});

const LINCOLN = [L_PLAIN, L_VDB, L_S_VDB, L_1931S, L_1931D];

// "We Are Strong. We Are Together": every card shares one eyebrow
const WAS_NAME = 'Ukraine Commemorative 10 Hryvnias';
const WAS_SERIES = 'We Are Strong. We Are Together';
function wasSlot(position: number, id: string, oblast: string, year: number, owned = false): GapSlot {
  return slot(position, id, {
    year,
    country: 'Ukraine',
    denomination: '10 Hryvnias',
    name: WAS_NAME,
    variety: `${WAS_SERIES}: ${oblast}`,
    owned,
  });
}
const WAS_DONETSK = wasSlot(20, 'donetsk', 'Donetsk Oblast', 2025);
const WAS_LUHANSK = wasSlot(21, 'luhansk', 'Luhansk Oblast', 2025, true);
const WAS_KYIV = wasSlot(22, 'kyiv', 'Kyiv Oblast', 2026);
const WAS = [WAS_DONETSK, WAS_LUHANSK, WAS_KYIV];

// Ukrainian commemoratives: one coin with an eyebrow, one without -> no shared eyebrow
const COMM_SERIES = slot(30, 'comm-series', {
  year: 2023,
  country: 'Ukraine',
  denomination: '10 Hryvnias',
  name: WAS_NAME,
  variety: `${WAS_SERIES}: Odesa Oblast`,
});
const COMM_BRIDGE = slot(31, 'comm-bridge', {
  year: 2023,
  country: 'Ukraine',
  denomination: '10 Hryvnias',
  name: WAS_NAME,
  variety: 'Antonivskyi Bridge',
});

// Plain Ukrainian circulation coins
const KOP_1 = slot(40, 'kop1', {
  year: 2014,
  country: 'Ukraine',
  denomination: '1 Kopiyka',
  name: 'Ukraine Circulation 1 Kopiyka',
});
const KOP_10 = slot(41, 'kop10', {
  year: 2014,
  country: 'Ukraine',
  denomination: '10 Kopiyok',
  name: 'Ukraine Circulation 10 Kopiyok',
  variety: 'Brass-plated steel',
});

function renderAlbum(over: Partial<React.ComponentProps<typeof SetAlbum>> = {}) {
  const onToggle = vi.fn();
  const utils = render(<SetAlbum slots={LINCOLN} isOwner={true} gapOnly={false} onToggle={onToggle} {...over} />);
  return { onToggle, ...utils };
}

function cardByCoin(coinId: string): HTMLElement {
  const found = screen.getAllByTestId('set-album-card').find((el) => el.getAttribute('data-coin-id') === coinId);
  if (!found) throw new Error(`no card for ${coinId}`);
  return found;
}

function checkByCoin(coinId: string): HTMLElement {
  return within(cardByCoin(coinId)).getByTestId('set-album-card-check');
}

describe('SetAlbum: empty', () => {
  it('shows only the empty message, no legend, no pages', () => {
    renderAlbum({ slots: [] });

    expect(screen.getByTestId('set-album')).toBeInTheDocument();
    expect(screen.getByTestId('set-album-empty')).toHaveTextContent('This set has no coins yet.');
    expect(screen.queryByTestId('set-album-legend')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-card')).not.toBeInTheDocument();
  });

  it('points the owner to Add coins', () => {
    renderAlbum({ slots: [] });
    expect(screen.getByTestId('set-album-empty-owner-hint')).toHaveTextContent('Use "Add coins" to start filling it.');
  });

  it('shows no Add coins hint to a non-owner', () => {
    renderAlbum({ slots: [], isOwner: false });
    expect(screen.getByTestId('set-album-empty')).toHaveTextContent('This set has no coins yet.');
    expect(screen.queryByTestId('set-album-empty-owner-hint')).not.toBeInTheDocument();
  });

  it('does not show the empty message when there are slots', () => {
    renderAlbum();
    expect(screen.queryByTestId('set-album-empty')).not.toBeInTheDocument();
  });

  it('the empty message wins over the all-owned message when gapOnly is on', () => {
    renderAlbum({ slots: [], gapOnly: true });
    expect(screen.getByTestId('set-album-empty')).toBeInTheDocument();
    expect(screen.queryByTestId('set-album-all-owned')).not.toBeInTheDocument();
  });
});

describe('SetAlbum: pages, headings, counts', () => {
  it('renders one page per series, in position order, with heading (name plus country when missing) and count', () => {
    renderAlbum({ slots: [U_ONE, ...LINCOLN] });

    const pages = screen.getAllByTestId('set-album-page');
    expect(pages).toHaveLength(2);
    expect(within(pages[0]).getByTestId('set-album-page-heading').textContent).toBe('Lincoln Wheat Cent · USA');
    expect(within(pages[0]).getByTestId('set-album-page-count').textContent).toBe('3 of 5 owned');
    expect(within(pages[1]).getByTestId('set-album-page-heading').textContent).toBe('Commemorative · Ukraine');
    expect(within(pages[1]).getByTestId('set-album-page-count').textContent).toBe('0 of 1 owned');
  });

  it('drops the country from the heading when the name already contains it', () => {
    renderAlbum({ slots: WAS });
    const heading = screen.getByTestId('set-album-page-heading');
    expect(heading.textContent).toBe('Ukraine Commemorative 10 Hryvnias');
    expect(heading.textContent).not.toContain('·');
  });

  it('renders the legend once above all pages', () => {
    renderAlbum({ slots: [U_ONE, ...LINCOLN] });
    expect(screen.getAllByTestId('set-album-legend')).toHaveLength(1);
  });

  it('renders a table per mint-mark page with scope=col and scope=row headers', () => {
    renderAlbum();
    const table = screen.getByTestId('set-album-table');
    expect(table.tagName).toBe('TABLE');
    screen.getAllByTestId('set-album-col-header').forEach((th) => {
      expect(th.tagName).toBe('TH');
      expect(th).toHaveAttribute('scope', 'col');
    });
    screen.getAllByTestId('set-album-year-header').forEach((th) => {
      expect(th.tagName).toBe('TH');
      expect(th).toHaveAttribute('scope', 'row');
    });
  });

  it('puts the table inside the horizontal scroll container', () => {
    renderAlbum();
    const scroll = screen.getByTestId('set-album-scroll');
    expect(scroll.className).toContain('overflow-x-auto');
    expect(within(scroll).getByTestId('set-album-table')).toBeInTheDocument();
  });

  it('renders rows for present years ascending', () => {
    renderAlbum({ slots: [L_1931S, L_PLAIN] });
    const rows = screen.getAllByTestId('set-album-row');
    expect(rows.map((r) => r.getAttribute('data-year'))).toEqual(['1909', '1931']);
    expect(screen.getAllByTestId('set-album-year-header').map((h) => h.textContent)).toEqual(['1909', '1931']);
  });

  it('labels the empty mint mark column "No mint mark" instead of an em dash', () => {
    renderAlbum();
    const headers = screen.getAllByTestId('set-album-col-header');
    expect(headers.map((h) => h.getAttribute('data-mint-mark'))).toEqual(['', 'D', 'S']);
    expect(headers[0].textContent).toBe('No mint mark');
    expect(headers[0].textContent).not.toContain('—');
    expect(headers[1].textContent).toBe('D');
    expect(headers[2].textContent).toBe('S');
  });

  it('renders column footers with owned/total', () => {
    renderAlbum();
    const footers = screen.getAllByTestId('set-album-col-footer');
    expect(footers.map((f) => f.getAttribute('data-mint-mark'))).toEqual(['', 'D', 'S']);
    // '' : plain owned, VDB missing -> 1/2 ; D : 1931 D owned -> 1/1 ; S : svdb owned, 1931S missing -> 1/2
    expect(footers.map((f) => f.textContent)).toEqual(['1/2', '1/1', '1/2']);
  });

  it('footers and page count change with different ownership', () => {
    const allOwned = LINCOLN.map((s) => ({ ...s, owned: true }));
    renderAlbum({ slots: allOwned });
    expect(screen.getByTestId('set-album-page-count').textContent).toBe('5 of 5 owned');
    expect(screen.getAllByTestId('set-album-col-footer').map((f) => f.textContent)).toEqual(['2/2', '1/1', '2/2']);
  });

  it('uses the readable neutral-700 text for the page count', () => {
    renderAlbum();
    const count = screen.getByTestId('set-album-page-count');
    expect(count.className).toContain('text-neutral-700');
    expect(count.className).not.toContain('text-neutral-600');
  });
});

describe('SetAlbum: no-mint-mark pages use year rows with a wrapping card grid', () => {
  it('renders no table, scroll container, column headers, footers, rows or cells', () => {
    renderAlbum({ slots: WAS });

    expect(screen.queryByTestId('set-album-table')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-scroll')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-col-header')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-col-footer')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-row')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-cell')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-blank-cell')).not.toBeInTheDocument();
    expect(screen.getByTestId('set-album').textContent).not.toContain('—');
  });

  it('renders one year group per year ascending, with an h3 label and a grid containing auto-fill', () => {
    renderAlbum({ slots: [WAS_KYIV, ...WAS_SLOTS_2025()] });

    const groups = screen.getAllByTestId('set-album-year-group');
    expect(groups.map((g) => g.getAttribute('data-year'))).toEqual(['2025', '2026']);
    const labels = screen.getAllByTestId('set-album-year-label');
    expect(labels.map((l) => l.textContent)).toEqual(['2025', '2026']);
    labels.forEach((l) => expect(l.tagName).toBe('H3'));
    const grids = screen.getAllByTestId('set-album-year-grid');
    expect(grids).toHaveLength(2);
    grids.forEach((g) => {
      expect(g.tagName).toBe('UL');
      expect(g.className).toContain('auto-fill');
    });
  });

  it('sets each year group label in Plex Mono 20px medium with tabular lining numerals, not in the heading font', () => {
    renderAlbum({ slots: [WAS_KYIV, ...WAS_SLOTS_2025()] });

    const labels = screen.getAllByTestId('set-album-year-label');
    expect(labels).toHaveLength(2);
    labels.forEach((label) => {
      expect(label.className).toContain('font-mono');
      expect(label.className).toContain('text-[20px]');
      expect(label.className).toContain('font-medium');
      expect(label.className).toContain('lining-nums');
      expect(label.className).toContain('tabular-nums');
      expect(label.className).not.toContain('text-[26px]');
      expect(label.className).not.toContain('font-[family-name:var(--font-heading)]');
    });
  });

  it('sizes the year grid with a 170px minimum column', () => {
    renderAlbum({ slots: WAS });
    screen.getAllByTestId('set-album-year-grid').forEach((g) => {
      expect(g.className).toContain('minmax(min(170px,100%),1fr)');
      expect(g.className).not.toContain('172px');
    });
  });

  it("puts each year's cards into that year's grid, in position order", () => {
    renderAlbum({ slots: [WAS_KYIV, WAS_LUHANSK, WAS_DONETSK] });

    const [g2025, g2026] = screen.getAllByTestId('set-album-year-group');
    expect(
      within(g2025)
        .getAllByTestId('set-album-card')
        .map((c) => c.getAttribute('data-coin-id')),
    ).toEqual(['coin-donetsk', 'coin-luhansk']);
    expect(
      within(g2026)
        .getAllByTestId('set-album-card')
        .map((c) => c.getAttribute('data-coin-id')),
    ).toEqual(['coin-kyiv']);
  });

  it('still uses the table on a page with mint marks, next to a grid page', () => {
    renderAlbum({ slots: [...LINCOLN, ...WAS] });

    const [lincoln, was] = screen.getAllByTestId('set-album-page');
    expect(within(lincoln).getByTestId('set-album-table')).toBeInTheDocument();
    expect(within(lincoln).queryByTestId('set-album-year-group')).not.toBeInTheDocument();
    expect(within(was).queryByTestId('set-album-table')).not.toBeInTheDocument();
    expect(within(was).getAllByTestId('set-album-year-group').length).toBeGreaterThan(0);
  });

  it('names plain Ukrainian circulation coins by their type name or design, with numeral placeholders', () => {
    renderAlbum({ slots: [KOP_1, KOP_10] });

    // The type name is the title; country and denomination are already in it, so only the year is left.
    const k1 = cardByCoin('coin-kop1');
    expect(within(k1).getByTestId('set-album-card-title').textContent).toBe('Ukraine Circulation 1 Kopiyka');
    expect(within(k1).getByTestId('set-album-card-secondary').textContent).toBe('2014');
    expect(within(k1).queryByTestId('set-album-card-eyebrow')).not.toBeInTheDocument();
    expect(within(k1).getByTestId('set-album-card-numeral').textContent).toBe('1');

    // The design is the title, the type name moves up to the eyebrow, the subtitle keeps all three parts.
    const k10 = cardByCoin('coin-kop10');
    expect(within(k10).getByTestId('set-album-card-title').textContent).toBe('Brass-plated steel');
    expect(within(k10).getByTestId('set-album-card-eyebrow').textContent).toBe('Ukraine Circulation 10 Kopiyok');
    expect(within(k10).getByTestId('set-album-card-secondary').textContent).toBe('Ukraine · 10 Kopiyok · 2014');
    expect(within(k10).getByTestId('set-album-card-numeral').textContent).toBe('10');
  });
});

describe('SetAlbum: cells (mint-mark pages)', () => {
  it('shows several varieties as separate cards in the same cell', () => {
    renderAlbum();
    const cells = screen.getAllByTestId('set-album-cell');
    const cell1909 = cells.find(
      (c) => c.getAttribute('data-year') === '1909' && c.getAttribute('data-mint-mark') === '',
    );
    expect(cell1909).toBeDefined();
    const cards = within(cell1909!).getAllByTestId('set-album-card');
    expect(cards.map((s) => s.getAttribute('data-coin-id'))).toEqual(['coin-plain', 'coin-vdb']);
  });

  it('renders blank cells for years/mint marks with no coin, with no card or focusable element', () => {
    renderAlbum();
    const blanks = screen.getAllByTestId('set-album-blank-cell');
    // 1909 D, 1931 ''
    expect(blanks).toHaveLength(2);
    expect(blanks.map((b) => `${b.getAttribute('data-year')}|${b.getAttribute('data-mint-mark')}`).sort()).toEqual([
      '1909|D',
      '1931|',
    ]);
    blanks.forEach((blank) => {
      expect(blank.tagName).toBe('TD');
      expect(within(blank).queryByTestId('set-album-card')).not.toBeInTheDocument();
      expect(blank.querySelector('button, a, input, select, textarea, [tabindex]')).toBeNull();
      expect(blank.textContent).toBe('No coin in this set');
    });
  });

  it('does not count blank cells: cards total equals the coin count', () => {
    renderAlbum();
    expect(screen.getAllByTestId('set-album-card')).toHaveLength(LINCOLN.length);
    expect(screen.getAllByTestId('set-album-cell')).toHaveLength(4);
  });

  it('gives table card cells a 172px minimum width', () => {
    renderAlbum();
    screen.getAllByTestId('set-album-cell').forEach((cell) => {
      expect(cell.className).toContain('min-w-[172px]');
      expect(cell.className).not.toContain('min-w-[10rem]');
    });
  });
});

describe('SetAlbum: card text', () => {
  it('shows the getCoinName titles and subtitles for the Lincoln coins', () => {
    renderAlbum();

    // key date without a variety: date-style title, the year is left out of the subtitle
    const s1931 = cardByCoin('coin-1931s');
    expect(within(s1931).getByTestId('set-album-card-title').textContent).toBe('1931-S');
    expect(within(s1931).getByTestId('set-album-card-secondary').textContent).toBe('USA · Cent');

    // no variety: the type name is the title, and "Cent" is already in it
    const plain = cardByCoin('coin-plain');
    expect(within(plain).getByTestId('set-album-card-title').textContent).toBe('Lincoln Wheat Cent');
    expect(within(plain).getByTestId('set-album-card-secondary').textContent).toBe('USA · 1909');

    const d1931 = cardByCoin('coin-1931d');
    expect(within(d1931).getByTestId('set-album-card-title').textContent).toBe('Lincoln Wheat Cent');
    expect(within(d1931).getByTestId('set-album-card-secondary').textContent).toBe('USA · 1931-D');

    const vdb = cardByCoin('coin-vdb');
    expect(within(vdb).getByTestId('set-album-card-title').textContent).toBe('VDB');
    expect(within(vdb).getByTestId('set-album-card-secondary').textContent).toBe('USA · Cent · 1909');

    const svdb = cardByCoin('coin-svdb');
    expect(within(svdb).getByTestId('set-album-card-title').textContent).toBe('VDB');
    expect(within(svdb).getByTestId('set-album-card-secondary').textContent).toBe('USA · Cent · 1909-S');
  });

  it('shows the full long variety as the title without any shortening', () => {
    renderAlbum({ slots: [U_ONE] });
    expect(screen.getByTestId('set-album-card-title').textContent).toBe(U_ONE.coin.variety);
  });

  it('shows the type name as the eyebrow of a design that has no series, and none for coins titled by it', () => {
    renderAlbum();

    ['coin-vdb', 'coin-svdb', 'coin-1931s'].forEach((id) => {
      expect(within(cardByCoin(id)).getByTestId('set-album-card-eyebrow').textContent).toBe('Lincoln Wheat Cent');
    });
    expect(within(cardByCoin('coin-plain')).queryByTestId('set-album-card-eyebrow')).not.toBeInTheDocument();
    expect(within(cardByCoin('coin-1931d')).queryByTestId('set-album-card-eyebrow')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('set-album-card-eyebrow')).toHaveLength(3);
  });

  it('sets data-owned, data-key-date and data-coin-id per card', () => {
    renderAlbum();
    expect(cardByCoin('coin-plain')).toHaveAttribute('data-owned', 'true');
    expect(cardByCoin('coin-vdb')).toHaveAttribute('data-owned', 'false');
    expect(cardByCoin('coin-1931s')).toHaveAttribute('data-key-date', 'true');
    expect(cardByCoin('coin-plain')).toHaveAttribute('data-key-date', 'false');
  });

  it('renders each card as a list item', () => {
    renderAlbum();
    screen.getAllByTestId('set-album-card').forEach((c) => expect(c.tagName).toBe('LI'));
  });

  it('shows the "★ Key date" badge only on key-date coins', () => {
    renderAlbum();
    const badges = screen.getAllByTestId('set-album-card-key-date');
    expect(badges).toHaveLength(1);
    expect(badges[0].textContent).toBe('★ Key date');
    expect(within(cardByCoin('coin-1931s')).getByTestId('set-album-card-key-date')).toBe(badges[0]);
    expect(within(cardByCoin('coin-plain')).queryByTestId('set-album-card-key-date')).not.toBeInTheDocument();
  });
});

describe('SetAlbum: eyebrow hoisting', () => {
  it('shows a shared eyebrow once under the page heading and omits it from every card', () => {
    renderAlbum({ slots: WAS });

    const eyebrows = screen.getAllByTestId('set-album-page-eyebrow');
    expect(eyebrows).toHaveLength(1);
    expect(eyebrows[0].textContent).toBe(WAS_SERIES);
    expect(screen.queryByTestId('set-album-card-eyebrow')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('set-album-card-title').map((t) => t.textContent)).toEqual([
      'Donetsk Oblast',
      'Luhansk Oblast',
      'Kyiv Oblast',
    ]);
    expect(screen.getAllByTestId('set-album-card-secondary').map((t) => t.textContent)).toEqual([
      'Ukraine · 10 Hryvnias · 2025',
      'Ukraine · 10 Hryvnias · 2025',
      'Ukraine · 10 Hryvnias · 2026',
    ]);
  });

  it('shows per-card eyebrows and no page eyebrow when eyebrows are not shared', () => {
    renderAlbum({ slots: [COMM_SERIES, COMM_BRIDGE] });

    expect(screen.queryByTestId('set-album-page-eyebrow')).not.toBeInTheDocument();
    const eyebrows = screen.getAllByTestId('set-album-card-eyebrow');
    expect(eyebrows.map((e) => e.textContent)).toEqual([WAS_SERIES, WAS_NAME]);
    expect(within(cardByCoin('coin-comm-series')).getByTestId('set-album-card-eyebrow')).toBe(eyebrows[0]);
    // the standalone design has no series, so the coin's type name is its eyebrow
    expect(within(cardByCoin('coin-comm-bridge')).getByTestId('set-album-card-eyebrow')).toBe(eyebrows[1]);
    expect(within(cardByCoin('coin-comm-bridge')).getByTestId('set-album-card-title').textContent).toBe(
      'Antonivskyi Bridge',
    );
  });

  it('does not hoist with a single coin on the page', () => {
    renderAlbum({ slots: [COMM_SERIES] });
    expect(screen.queryByTestId('set-album-page-eyebrow')).not.toBeInTheDocument();
    expect(screen.getByTestId('set-album-card-eyebrow').textContent).toBe(WAS_SERIES);
  });

  it('keeps the series in the link accessible name even when hoisted', () => {
    renderAlbum({ slots: WAS });
    expect(within(cardByCoin('coin-donetsk')).getByTestId('set-album-card-link')).toHaveAttribute(
      'aria-label',
      'We Are Strong. We Are Together: Donetsk Oblast, 2025, 10 Hryvnias, missing',
    );
  });
});

describe('SetAlbum: coin circle', () => {
  it('shows the denomination numeral placeholder when there is no image', () => {
    renderAlbum({ slots: WAS });
    const card = cardByCoin('coin-donetsk');
    expect(within(card).getByTestId('set-album-card-numeral').textContent).toBe('10');
    expect(within(card).queryByTestId('set-album-card-image')).not.toBeInTheDocument();
  });

  it('uses 1 for the numberless Cent denomination', () => {
    renderAlbum();
    expect(within(cardByCoin('coin-vdb')).getByTestId('set-album-card-numeral').textContent).toBe('1');
  });

  it('shows the image instead of the numeral when imageUrl is set', () => {
    const withImage = slot(0, 'img', { year: 1909, imageUrl: 'https://example.com/coin.jpg' });
    renderAlbum({ slots: [withImage, L_VDB] });

    const card = cardByCoin('coin-img');
    const img = within(card).getByTestId('set-album-card-image');
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('src', 'https://example.com/coin.jpg');
    expect(img).toHaveAttribute('alt', '');
    expect(within(card).queryByTestId('set-album-card-numeral')).not.toBeInTheDocument();
    // a sibling without an image keeps its numeral
    expect(within(cardByCoin('coin-vdb')).queryByTestId('set-album-card-image')).not.toBeInTheDocument();
    expect(within(cardByCoin('coin-vdb')).getByTestId('set-album-card-numeral')).toBeInTheDocument();
  });

  it('renders the photo lazily, round and contained (never cropped)', () => {
    const withImage = slot(0, 'img', { year: 1909, imageUrl: 'https://example.com/coin.jpg' });
    renderAlbum({ slots: [withImage] });

    const img = screen.getByTestId('set-album-card-image');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img.className).toContain('object-contain');
    expect(img.className).not.toContain('object-cover');
    expect(img.className).toContain('rounded-full');
  });

  it('applies the placeholder disc look only when there is no image', () => {
    const withImage = slot(0, 'img', { year: 1909, imageUrl: 'https://example.com/coin.jpg' });
    renderAlbum({ slots: [withImage, L_VDB] });

    const photoCircle = within(cardByCoin('coin-img')).getByTestId('set-album-card-circle');
    const placeholderCircle = within(cardByCoin('coin-vdb')).getByTestId('set-album-card-circle');
    expect(photoCircle.className).not.toContain('bg-neutral-300');
    expect(photoCircle.className).not.toContain('border-neutral-400');
    expect(placeholderCircle.className).toContain('bg-neutral-300');
    expect(placeholderCircle.className).toContain('border-neutral-400');
  });

  it('hides the circle from assistive tech', () => {
    renderAlbum();
    screen.getAllByTestId('set-album-card-circle').forEach((c) => expect(c).toHaveAttribute('aria-hidden', 'true'));
    expect(screen.getAllByTestId('set-album-card-circle')).toHaveLength(LINCOLN.length);
  });

  it('states ownership in words on every card, so it is not colour-only', () => {
    renderAlbum();
    const status = (id: string) => within(cardByCoin(id)).getByTestId('set-album-card-status');
    // plain, svdb, 1931d are owned
    expect(status('coin-plain').textContent).toBe('In collection');
    expect(status('coin-svdb').textContent).toBe('In collection');
    expect(status('coin-vdb').textContent).toBe('Missing');
    expect(status('coin-1931s').textContent).toBe('Missing');
  });

  it('shows the coin year instead of ownership to a visitor on a table page, with a neutral full-strength coin', () => {
    renderAlbum({ isOwner: false });
    const card = cardByCoin('coin-plain');
    expect(within(card).getByTestId('set-album-card-status').textContent).toBe('1909');
    expect(within(card).queryByTestId('set-album-card-check')).not.toBeInTheDocument();
    expect(within(card).getByTestId('set-album-card-circle').className).not.toMatch(/opacity-50|grayscale/);

    // a different year gives a different status, so it is not a constant
    expect(within(cardByCoin('coin-1931s')).getByTestId('set-album-card-status').textContent).toBe('1931');

    // missing coins are not faded for a visitor either
    ['coin-vdb', 'coin-1931s'].forEach((id) => {
      expect(within(cardByCoin(id)).getByTestId('set-album-card-circle').className).not.toMatch(
        /opacity-50|grayscale/,
      );
    });
  });

  it('does not fade a missing coin with a photo for a visitor', () => {
    const missing = slot(0, 'imgmissingvisitor', {
      year: 1910,
      imageUrl: 'https://example.com/b.jpg',
      owned: false,
    });
    renderAlbum({ slots: [missing], isOwner: false });
    expect(
      within(cardByCoin('coin-imgmissingvisitor')).getByTestId('set-album-card-circle').className,
    ).not.toMatch(/opacity-50|grayscale/);
  });

  it('shows no status line to a visitor on a year-grid page, but keeps the card link', () => {
    renderAlbum({ slots: WAS, isOwner: false });
    expect(screen.queryByTestId('set-album-card-status')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('set-album-card')).toHaveLength(WAS.length);
    screen.getAllByTestId('set-album-card').forEach((card) => {
      expect(within(card).getByTestId('set-album-card-link')).toBeInTheDocument();
      expect(within(card).queryByTestId('set-album-card-check')).not.toBeInTheDocument();
    });
  });

  it('shows the status line to the owner on a year-grid page', () => {
    renderAlbum({ slots: WAS, isOwner: true });
    const status = (id: string) => within(cardByCoin(id)).getByTestId('set-album-card-status');
    expect(status('coin-donetsk').textContent).toBe('Missing');
    expect(status('coin-luhansk').textContent).toBe('In collection');
  });

  it('keeps every visitor card neutral regardless of ownership', () => {
    renderAlbum({ slots: WAS, isOwner: false });
    const owned = cardByCoin('coin-luhansk');
    const missing = cardByCoin('coin-donetsk');
    expect(owned.className).toContain('bg-neutral-100');
    expect(owned.className).not.toContain('bg-accent-100');
    expect(missing.className).toContain('bg-neutral-100');
  });

  it('fades only missing coins for the owner, on image circles too', () => {
    const owned = slot(0, 'imgowned', {
      year: 1909,
      imageUrl: 'https://example.com/a.jpg',
      owned: true,
    });
    const missing = slot(1, 'imgmissing', {
      year: 1910,
      imageUrl: 'https://example.com/b.jpg',
      owned: false,
    });
    renderAlbum({ slots: [owned, missing] });
    const circle = (id: string) => within(cardByCoin(id)).getByTestId('set-album-card-circle');
    expect(circle('coin-imgowned').className).not.toMatch(/opacity-50|grayscale/);
    expect(circle('coin-imgmissing').className).toMatch(/opacity-50/);
    expect(circle('coin-imgmissing').className).toMatch(/grayscale/);
  });

  it('shows an owned/total summary beside each year on a grid page', () => {
    renderAlbum({ slots: WAS });
    const groups = screen.getAllByTestId('set-album-year-group');
    expect(within(groups[0]).getByTestId('set-album-year-summary').textContent).toBe('1/2');
    expect(within(groups[1]).getByTestId('set-album-year-summary').textContent).toBe('0/1');
  });
});

describe('SetAlbum: legend', () => {
  it('no longer explains Owned / Missing / Key date, only the blank cell', () => {
    renderAlbum();
    const legend = screen.getByTestId('set-album-legend');
    expect(legend).toHaveTextContent('Not in this set');
    expect(legend).not.toHaveTextContent('Owned');
    expect(legend).not.toHaveTextContent('Missing');
    expect(legend).not.toHaveTextContent('Key date');
    expect(legend).not.toHaveTextContent('★');
    expect(within(legend).getAllByRole('listitem')).toHaveLength(1);
  });

  it('shows the "Not in this set" item only when some page has blank cells', () => {
    const { unmount } = renderAlbum();
    expect(screen.getByTestId('set-album-legend-blank')).toHaveTextContent('Not in this set');
    unmount();

    renderAlbum({ slots: WAS });
    expect(screen.queryByTestId('set-album-legend-blank')).not.toBeInTheDocument();
  });

  it('renders no legend at all when no page has blank cells', () => {
    renderAlbum({ slots: WAS });
    expect(screen.queryByTestId('set-album-legend')).not.toBeInTheDocument();
  });

  it('keeps the legend when a table page with blanks is rendered, even next to a grid page', () => {
    renderAlbum({ slots: [...LINCOLN, ...WAS] });
    expect(screen.getByTestId('set-album-legend-blank')).toBeInTheDocument();
  });

  it('drops the legend when the only page with blank cells is not rendered under the Missing filter', () => {
    const lincolnAllOwned = LINCOLN.map((s) => ({ ...s, owned: true }));
    renderAlbum({ slots: [...lincolnAllOwned, U_ONE], gapOnly: true });
    expect(screen.getAllByTestId('set-album-page')).toHaveLength(1);
    expect(screen.queryByTestId('set-album-legend')).not.toBeInTheDocument();
  });
});

describe('SetAlbum: card link', () => {
  it('links every card to its catalog page with a full accessible name, for the owner', () => {
    renderAlbum();
    const links = screen.getAllByTestId('set-album-card-link');
    expect(links).toHaveLength(LINCOLN.length);
    links.forEach((l) => expect(l.tagName).toBe('A'));

    const key = within(cardByCoin('coin-1931s')).getByTestId('set-album-card-link');
    expect(key).toHaveAttribute('href', '/catalog/coin-1931s');
    expect(key).toHaveAttribute('aria-label', '1931-S, Cent, missing, key date');

    const vdb = within(cardByCoin('coin-vdb')).getByTestId('set-album-card-link');
    expect(vdb).toHaveAttribute('href', '/catalog/coin-vdb');
    expect(vdb).toHaveAttribute('aria-label', 'VDB, 1909, Cent, missing');

    const owned = within(cardByCoin('coin-svdb')).getByTestId('set-album-card-link');
    expect(owned).toHaveAttribute('aria-label', 'VDB, 1909-S, Cent, owned');
  });

  it('puts the title inside the link', () => {
    renderAlbum();
    const link = within(cardByCoin('coin-vdb')).getByTestId('set-album-card-link');
    expect(within(link).getByTestId('set-album-card-title').textContent).toBe('VDB');
  });

  it('links every card for a non-owner as well', () => {
    renderAlbum({ isOwner: false });
    const cards = screen.getAllByTestId('set-album-card');
    expect(cards).toHaveLength(LINCOLN.length);
    cards.forEach((card) => {
      const link = within(card).getByTestId('set-album-card-link');
      expect(link).toHaveAttribute('href', `/catalog/${card.getAttribute('data-coin-id')}`);
    });
  });

  it('contains no ↗ anywhere', () => {
    renderAlbum({ slots: [...LINCOLN, ...WAS, U_ONE] });
    expect(screen.getByTestId('set-album').textContent).not.toContain('↗');
    expect(screen.queryByTestId('set-album-slot-catalog-link')).not.toBeInTheDocument();
  });

  it('renders none of the removed slot elements', () => {
    renderAlbum();
    expect(screen.queryByTestId('set-album-slot')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-slot-variety')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-key-date-marker')).not.toBeInTheDocument();
  });
});

describe('SetAlbum: no truncation', () => {
  it('uses no truncating classes on the card or its text elements', () => {
    renderAlbum({ slots: [U_ONE, ...WAS, ...LINCOLN, COMM_SERIES, COMM_BRIDGE] });
    const forbidden = /(truncate|line-clamp|whitespace-nowrap|overflow-hidden)/;

    const elements = [
      ...screen.getAllByTestId('set-album-card'),
      ...screen.getAllByTestId('set-album-card-link'),
      ...screen.getAllByTestId('set-album-card-title'),
      ...screen.getAllByTestId('set-album-card-secondary'),
      ...screen.getAllByTestId('set-album-card-eyebrow'),
    ];
    expect(elements.length).toBeGreaterThan(0);
    elements.forEach((el) => expect(el.className).not.toMatch(forbidden));
  });
});

describe('SetAlbum: owner check button', () => {
  it('renders a round button per card for the owner, with a 44px hit area', () => {
    renderAlbum();
    const buttons = screen.getAllByTestId('set-album-card-check');
    expect(buttons).toHaveLength(LINCOLN.length);
    buttons.forEach((b) => {
      expect(b.tagName).toBe('BUTTON');
      expect(b).toHaveAttribute('type', 'button');
      expect(b.className).toContain('h-11');
      expect(b.className).toContain('w-11');
    });
    expect(checkByCoin('coin-vdb')).toHaveAttribute('data-coin-id', 'coin-vdb');
  });

  it('renders no check button for a non-owner', () => {
    renderAlbum({ isOwner: false });
    expect(screen.queryByTestId('set-album-card-check')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('reflects ownership in aria-pressed', () => {
    renderAlbum();
    expect(checkByCoin('coin-plain')).toHaveAttribute('aria-pressed', 'true');
    expect(checkByCoin('coin-vdb')).toHaveAttribute('aria-pressed', 'false');
  });

  it('has a translated, coin-specific accessible name that flips with ownership', () => {
    renderAlbum();
    expect(checkByCoin('coin-1931s')).toHaveAttribute('aria-label', 'Mark 1931-S as owned');
    expect(checkByCoin('coin-vdb')).toHaveAttribute('aria-label', 'Mark VDB 1909 as owned');
    expect(checkByCoin('coin-plain')).toHaveAttribute('aria-label', 'Mark 1909 as missing');
    expect(checkByCoin('coin-svdb')).toHaveAttribute('aria-label', 'Mark VDB 1909-S as missing');
  });

  it('names a WAS coin by oblast and year', () => {
    renderAlbum({ slots: WAS });
    expect(checkByCoin('coin-donetsk')).toHaveAttribute('aria-label', 'Mark Donetsk Oblast 2025 as owned');
    expect(checkByCoin('coin-luhansk')).toHaveAttribute('aria-label', 'Mark Luhansk Oblast 2025 as missing');
  });

  it('calls onToggle(coinId, currentlyOwned) exactly once for a missing coin', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderAlbum();

    await user.click(checkByCoin('coin-vdb'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('coin-vdb', false);
  });

  it('passes currentlyOwned=true for an owned coin', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderAlbum();

    await user.click(checkByCoin('coin-plain'));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith('coin-plain', true);
  });

  it('does not toggle when the card link is clicked, and the toggle does not click through to the link', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderAlbum();
    const link = within(cardByCoin('coin-vdb')).getByTestId('set-album-card-link');
    const linkClicked = vi.fn((e: Event) => e.preventDefault()); // keep jsdom from navigating
    link.addEventListener('click', linkClicked);

    await user.click(link);
    expect(onToggle).not.toHaveBeenCalled();
    expect(linkClicked).toHaveBeenCalledTimes(1);

    await user.click(checkByCoin('coin-vdb'));
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(linkClicked).toHaveBeenCalledTimes(1);
  });

  it('disables only the pending coins (pendingCoinIds), which ignore clicks', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderAlbum({ pendingCoinIds: new Set(['coin-vdb', 'coin-1931s']) });

    expect(checkByCoin('coin-vdb')).toBeDisabled();
    expect(checkByCoin('coin-vdb')).toHaveAttribute('aria-busy', 'true');
    expect(checkByCoin('coin-1931s')).toBeDisabled();
    expect(checkByCoin('coin-plain')).toBeEnabled();
    expect(checkByCoin('coin-plain')).not.toHaveAttribute('aria-busy');

    await user.click(checkByCoin('coin-vdb'));
    expect(onToggle).not.toHaveBeenCalled();
    await user.click(checkByCoin('coin-plain'));
    expect(onToggle).toHaveBeenCalledWith('coin-plain', true);
  });

  it('marks only the single pendingCoinId busy and disabled, leaving the link usable', () => {
    renderAlbum({ pendingCoinId: 'coin-vdb' });
    expect(checkByCoin('coin-vdb')).toBeDisabled();
    expect(checkByCoin('coin-vdb')).toHaveAttribute('aria-busy', 'true');
    expect(checkByCoin('coin-plain')).toBeEnabled();
    expect(checkByCoin('coin-plain')).not.toHaveAttribute('aria-busy');
    const link = within(cardByCoin('coin-vdb')).getByTestId('set-album-card-link');
    expect(link).toHaveAttribute('href', '/catalog/coin-vdb');
  });

  it('shows a toggle error alert only when toggleFailed is set', () => {
    const { rerender } = renderAlbum();
    expect(screen.queryByTestId('set-album-toggle-error')).not.toBeInTheDocument();

    rerender(<SetAlbum slots={LINCOLN} isOwner={true} gapOnly={false} onToggle={vi.fn()} toggleFailed />);
    expect(screen.getByRole('alert')).toHaveTextContent("Couldn't update this coin. Please try again.");
  });
});

describe('SetAlbum: no nested interactive elements and tab order', () => {
  it('keeps the link and the check button as siblings inside the card, never nested', () => {
    renderAlbum();
    screen.getAllByTestId('set-album-card').forEach((card) => {
      const link = within(card).getByTestId('set-album-card-link');
      const check = within(card).getByTestId('set-album-card-check');
      expect(link.querySelector('button, a')).toBeNull();
      expect(check.querySelector('button, a')).toBeNull();
      expect(link.contains(check)).toBe(false);
      expect(check.contains(link)).toBe(false);
      expect(check.closest('a')).toBeNull();
      expect(link.closest('button')).toBeNull();
      expect(card.contains(link)).toBe(true);
      expect(card.contains(check)).toBe(true);
    });
  });

  it('tabs to the card link first, then the check button', async () => {
    const user = userEvent.setup();
    renderAlbum({ slots: [L_PLAIN] });

    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId('set-album-card-link'));
    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId('set-album-card-check'));
  });

  it('tabs only to the link for a non-owner', async () => {
    const user = userEvent.setup();
    renderAlbum({ slots: [L_PLAIN], isOwner: false });

    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId('set-album-card-link'));
    await user.tab();
    expect(document.activeElement).not.toBe(screen.getByTestId('set-album-card-link'));
  });
});

describe('SetAlbum: hover and focus styling hooks', () => {
  it('gives the card a hover state and the check button hover and focus-visible states', () => {
    renderAlbum({ slots: [L_PLAIN] });
    expect(screen.getByTestId('set-album-card').className).toMatch(/hover:/);
    const check = screen.getByTestId('set-album-card-check');
    expect(check.className).toMatch(/hover:/);
    expect(check.className).toMatch(/focus-visible:/);
    expect(screen.getByTestId('set-album-card-link').className).toMatch(/focus-visible:/);
  });

  it('mirrors the card hover on focus-within, and gates the lift behind motion-safe', () => {
    renderAlbum({ slots: [L_PLAIN] });
    const card = screen.getByTestId('set-album-card');
    expect(card.className).toContain('focus-within:border-accent');
    expect(card.className).toContain('focus-within:shadow-md');
    expect(card.className).toContain('motion-safe:hover:-translate-y-0.5');
    expect(card.className).toContain('motion-safe:focus-within:-translate-y-0.5');
    // the lift is never applied without motion-safe
    expect(card.className).not.toMatch(/(^|\s)hover:-translate-y-0\.5/);
    expect(card.className).not.toMatch(/(^|\s)focus-within:-translate-y-0\.5/);
  });

  it('underlines the title on focus-within as well as hover, and scales the photo only under motion-safe', () => {
    renderAlbum({ slots: [L_PLAIN] });
    const link = screen.getByTestId('set-album-card-link');
    expect(link.className).toContain('group-hover:text-accent-700');
    expect(link.className).toContain('group-focus-within:text-accent-700');
    expect(link.className).toContain('group-focus-within:underline');

    const circle = screen.getByTestId('set-album-card-circle');
    expect(circle.className).toContain('motion-safe:group-hover:scale-105');
    expect(circle.className).toContain('motion-safe:group-focus-within:scale-105');
    expect(circle.className).not.toMatch(/(^|\s)group-hover:scale-105/);
  });
});

describe('SetAlbum: Missing filter (gapOnly) hides owned cards', () => {
  it('renders only the missing cards, never muting or dimming anything', () => {
    renderAlbum({ gapOnly: true });

    const cards = screen.getAllByTestId('set-album-card');
    expect(cards.map((c) => c.getAttribute('data-coin-id')).sort()).toEqual(['coin-1931s', 'coin-vdb']);
    expect(screen.queryByText('In collection')).not.toBeInTheDocument();
    cards.forEach((card) => {
      expect(card).not.toHaveAttribute('data-muted');
      expect(card.className).not.toContain('opacity-40');
      expect(card).toHaveAttribute('data-owned', 'false');
    });
  });

  it('does not render owned cards on a grid page either', () => {
    renderAlbum({ slots: WAS, gapOnly: true });
    expect(screen.getAllByTestId('set-album-card').map((c) => c.getAttribute('data-coin-id'))).toEqual([
      'coin-donetsk',
      'coin-kyiv',
    ]);
    expect(screen.getAllByTestId('set-album-card-check').map((b) => b.getAttribute('data-coin-id'))).toEqual([
      'coin-donetsk',
      'coin-kyiv',
    ]);
  });

  it('shows every card, owned and missing, when gapOnly is false', () => {
    renderAlbum({ gapOnly: false });
    expect(screen.getAllByTestId('set-album-card')).toHaveLength(LINCOLN.length);
    screen.getAllByTestId('set-album-card').forEach((c) => expect(c).not.toHaveAttribute('data-muted'));
  });

  it('keeps blank cells and cells in the full table layout, but without cards in cells whose slots are all owned', () => {
    renderAlbum({ gapOnly: true });

    expect(screen.getAllByTestId('set-album-blank-cell')).toHaveLength(2);
    expect(screen.getAllByTestId('set-album-cell')).toHaveLength(4);
    const svdbCell = screen
      .getAllByTestId('set-album-cell')
      .find((c) => c.getAttribute('data-year') === '1909' && c.getAttribute('data-mint-mark') === 'S');
    expect(svdbCell).toBeDefined();
    expect(within(svdbCell!).queryByTestId('set-album-card')).not.toBeInTheDocument();

    const mixedCell = screen
      .getAllByTestId('set-album-cell')
      .find((c) => c.getAttribute('data-year') === '1909' && c.getAttribute('data-mint-mark') === '');
    expect(within(mixedCell!).getAllByTestId('set-album-card').map((c) => c.getAttribute('data-coin-id'))).toEqual([
      'coin-vdb',
    ]);
  });

  it('removes a table row that has no visible card', () => {
    // 1909 is fully owned, 1931 has a missing coin
    const { unmount } = renderAlbum({ slots: [L_PLAIN, L_1931S], gapOnly: true });
    expect(screen.getAllByTestId('set-album-row').map((r) => r.getAttribute('data-year'))).toEqual(['1931']);
    expect(screen.getAllByTestId('set-album-year-header').map((h) => h.textContent)).toEqual(['1931']);
    unmount();

    // without the filter both rows are there
    renderAlbum({ slots: [L_PLAIN, L_1931S], gapOnly: false });
    expect(screen.getAllByTestId('set-album-row').map((r) => r.getAttribute('data-year'))).toEqual(['1909', '1931']);
  });

  it('removes a year group on a grid page that has no visible card, but keeps full year summaries', () => {
    // 2025: only Luhansk (owned) -> group vanishes; 2026: Kyiv (missing)
    renderAlbum({ slots: [WAS_LUHANSK, WAS_KYIV], gapOnly: true });
    const groups = screen.getAllByTestId('set-album-year-group');
    expect(groups.map((g) => g.getAttribute('data-year'))).toEqual(['2026']);
    expect(within(groups[0]).getByTestId('set-album-year-summary').textContent).toBe('0/1');
  });

  it('keeps the year summary at the full owned/total while hiding the owned card', () => {
    renderAlbum({ slots: WAS, gapOnly: true });
    const g2025 = screen.getAllByTestId('set-album-year-group')[0];
    expect(within(g2025).getByTestId('set-album-year-summary').textContent).toBe('1/2');
    expect(within(g2025).getAllByTestId('set-album-card')).toHaveLength(1);
  });

  it('does not render a page that has no visible card', () => {
    const lincolnAllOwned = LINCOLN.map((s) => ({ ...s, owned: true }));
    renderAlbum({ slots: [...lincolnAllOwned, U_ONE], gapOnly: true });

    const pages = screen.getAllByTestId('set-album-page');
    expect(pages).toHaveLength(1);
    expect(within(pages[0]).getByTestId('set-album-page-heading').textContent).toBe('Commemorative · Ukraine');
    expect(screen.queryByTestId('set-album-table')).not.toBeInTheDocument();
  });

  it('keeps counts and column footers unchanged by the filter', () => {
    renderAlbum({ gapOnly: true });
    expect(screen.getByTestId('set-album-page-count').textContent).toBe('3 of 5 owned');
    expect(screen.getAllByTestId('set-album-col-footer').map((f) => f.textContent)).toEqual(['1/2', '1/1', '1/2']);
  });

  it('remaining cards stay interactive for the owner', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderAlbum({ gapOnly: true });

    await user.click(checkByCoin('coin-vdb'));

    expect(onToggle).toHaveBeenCalledWith('coin-vdb', false);
    expect(within(cardByCoin('coin-vdb')).getByTestId('set-album-card-link')).toHaveAttribute(
      'href',
      '/catalog/coin-vdb',
    );
  });
});

describe('SetAlbum: all owned under the Missing filter', () => {
  const lincolnAllOwned = LINCOLN.map((s) => ({ ...s, owned: true }));

  it('shows a centered "nothing missing" message instead of the pages', () => {
    renderAlbum({ slots: lincolnAllOwned, gapOnly: true });

    const message = screen.getByTestId('set-album-all-owned');
    expect(message).toHaveTextContent('Nothing missing — this set is complete.');
    expect(message.className).toContain('text-center');
    expect(message.className).toContain('bg-surface');
    expect(screen.getByTestId('set-album')).toContainElement(message);
    expect(screen.queryByTestId('set-album-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-legend')).not.toBeInTheDocument();
    expect(screen.queryByTestId('set-album-empty')).not.toBeInTheDocument();
  });

  it('does not show the message with the All coins view, which renders every owned card', () => {
    renderAlbum({ slots: lincolnAllOwned, gapOnly: false });
    expect(screen.queryByTestId('set-album-all-owned')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('set-album-card')).toHaveLength(LINCOLN.length);
  });

  it('does not show the message while at least one coin is missing', () => {
    const oneMissing = lincolnAllOwned.map((s) => (s.coin.id === 'coin-vdb' ? { ...s, owned: false } : s));
    renderAlbum({ slots: oneMissing, gapOnly: true });
    expect(screen.queryByTestId('set-album-all-owned')).not.toBeInTheDocument();
    expect(screen.getAllByTestId('set-album-card')).toHaveLength(1);
  });

  it('shows the message on a grid-only set too', () => {
    renderAlbum({ slots: WAS.map((s) => ({ ...s, owned: true })), gapOnly: true });
    expect(screen.getByTestId('set-album-all-owned')).toBeInTheDocument();
    expect(screen.queryByTestId('set-album-year-group')).not.toBeInTheDocument();
  });

  it('shows the message for a visitor as well', () => {
    renderAlbum({ slots: lincolnAllOwned, gapOnly: true, isOwner: false });
    expect(screen.getByTestId('set-album-all-owned')).toBeInTheDocument();
  });

  it('still shows the toggle error next to the message', () => {
    renderAlbum({ slots: lincolnAllOwned, gapOnly: true, toggleFailed: true });
    expect(screen.getByTestId('set-album-toggle-error')).toBeInTheDocument();
    expect(screen.getByTestId('set-album-all-owned')).toBeInTheDocument();
  });
});

function WAS_SLOTS_2025(): GapSlot[] {
  return [WAS_DONETSK, WAS_LUHANSK];
}

describe('SetViewSwitch', () => {
  it('renders a labelled group with List and Album buttons', () => {
    render(<SetViewSwitch view="list" onChange={vi.fn()} />);

    const group = screen.getByTestId('set-editor-view-switch');
    expect(group).toHaveAttribute('role', 'group');
    expect(group).toHaveAttribute('aria-label', 'View');
    expect(screen.getByTestId('set-editor-view-list-toggle')).toHaveTextContent('List');
    expect(screen.getByTestId('set-editor-view-album-toggle')).toHaveTextContent('Album');
  });

  it('reflects the current view in aria-pressed', () => {
    const { rerender } = render(<SetViewSwitch view="list" onChange={vi.fn()} />);
    expect(screen.getByTestId('set-editor-view-list-toggle')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('set-editor-view-album-toggle')).toHaveAttribute('aria-pressed', 'false');

    rerender(<SetViewSwitch view="album" onChange={vi.fn()} />);
    expect(screen.getByTestId('set-editor-view-list-toggle')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('set-editor-view-album-toggle')).toHaveAttribute('aria-pressed', 'true');
  });

  it('calls onChange with the clicked view', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<SetViewSwitch view="list" onChange={onChange} />);

    await user.click(screen.getByTestId('set-editor-view-album-toggle'));
    expect(onChange).toHaveBeenLastCalledWith('album');

    await user.click(screen.getByTestId('set-editor-view-list-toggle'));
    expect(onChange).toHaveBeenLastCalledWith('list');
  });
});
