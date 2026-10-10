/**
 * Tests for: SetAlbum (coin cards) and SetViewSwitch components
 * Contract source: runs/run_20261010_083926/plan.md § Interface Contract → Component: SetAlbum
 * Covers criteria: #4, #5, #7, #8, #9, #13, #14, #15, #16, #17, #18 (class hooks), #19, #20, #22, #23, #24
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
  const utils = render(
    <SetAlbum slots={LINCOLN} isOwner={true} gapOnly={false} onToggle={onToggle} {...over} />,
  );
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

  it('puts each year\'s cards into that year\'s grid, in position order', () => {
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

  it('shows plain Ukrainian circulation coins titled by year with numeral placeholders', () => {
    renderAlbum({ slots: [KOP_1, KOP_10] });

    const k1 = cardByCoin('coin-kop1');
    expect(within(k1).getByTestId('set-album-card-title').textContent).toBe('2014');
    expect(within(k1).getByTestId('set-album-card-secondary').textContent).toBe('1 Kopiyka');
    expect(within(k1).getByTestId('set-album-card-numeral').textContent).toBe('1');

    const k10 = cardByCoin('coin-kop10');
    expect(within(k10).getByTestId('set-album-card-title').textContent).toBe('Brass-plated steel');
    expect(within(k10).getByTestId('set-album-card-secondary').textContent).toBe('2014 · 10 Kopiyok');
    expect(within(k10).getByTestId('set-album-card-numeral').textContent).toBe('10');
  });
});

describe('SetAlbum: cells (mint-mark pages)', () => {
  it('shows several varieties as separate cards in the same cell', () => {
    renderAlbum();
    const cells = screen.getAllByTestId('set-album-cell');
    const cell1909 = cells.find((c) => c.getAttribute('data-year') === '1909' && c.getAttribute('data-mint-mark') === '');
    expect(cell1909).toBeDefined();
    const cards = within(cell1909!).getAllByTestId('set-album-card');
    expect(cards.map((s) => s.getAttribute('data-coin-id'))).toEqual(['coin-plain', 'coin-vdb']);
  });

  it('renders blank cells for years/mint marks with no coin, with no card or focusable element', () => {
    renderAlbum();
    const blanks = screen.getAllByTestId('set-album-blank-cell');
    // 1909 D, 1931 ''
    expect(blanks).toHaveLength(2);
    expect(
      blanks.map((b) => `${b.getAttribute('data-year')}|${b.getAttribute('data-mint-mark')}`).sort(),
    ).toEqual(['1909|D', '1931|']);
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
});

describe('SetAlbum: card text', () => {
  it('shows the Lincoln notation titles and secondary lines', () => {
    renderAlbum();

    const s1931 = cardByCoin('coin-1931s');
    expect(within(s1931).getByTestId('set-album-card-title').textContent).toBe('1931-S');
    expect(within(s1931).getByTestId('set-album-card-secondary').textContent).toBe('Cent');

    const plain = cardByCoin('coin-plain');
    expect(within(plain).getByTestId('set-album-card-title').textContent).toBe('1909');
    expect(within(plain).getByTestId('set-album-card-secondary').textContent).toBe('Cent');

    const vdb = cardByCoin('coin-vdb');
    expect(within(vdb).getByTestId('set-album-card-title').textContent).toBe('VDB');
    expect(within(vdb).getByTestId('set-album-card-secondary').textContent).toBe('1909 · Cent');

    const svdb = cardByCoin('coin-svdb');
    expect(within(svdb).getByTestId('set-album-card-title').textContent).toBe('VDB');
    expect(within(svdb).getByTestId('set-album-card-secondary').textContent).toBe('1909-S · Cent');
  });

  it('shows the full long variety as the title without any shortening', () => {
    renderAlbum({ slots: [U_ONE] });
    expect(screen.getByTestId('set-album-card-title').textContent).toBe(U_ONE.coin.variety);
  });

  it('renders no eyebrow element for coins without an eyebrow', () => {
    renderAlbum();
    expect(screen.queryByTestId('set-album-card-eyebrow')).not.toBeInTheDocument();
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
      '2025 · 10 Hryvnias',
      '2025 · 10 Hryvnias',
      '2026 · 10 Hryvnias',
    ]);
  });

  it('shows per-card eyebrows and no page eyebrow when eyebrows are not shared', () => {
    renderAlbum({ slots: [COMM_SERIES, COMM_BRIDGE] });

    expect(screen.queryByTestId('set-album-page-eyebrow')).not.toBeInTheDocument();
    const eyebrows = screen.getAllByTestId('set-album-card-eyebrow');
    expect(eyebrows).toHaveLength(1);
    expect(eyebrows[0].textContent).toBe(WAS_SERIES);
    expect(within(cardByCoin('coin-comm-series')).getByTestId('set-album-card-eyebrow')).toBe(eyebrows[0]);
    expect(within(cardByCoin('coin-comm-bridge')).queryByTestId('set-album-card-eyebrow')).not.toBeInTheDocument();
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

  it('hides the circle from assistive tech', () => {
    renderAlbum();
    screen.getAllByTestId('set-album-card-circle').forEach((c) => expect(c).toHaveAttribute('aria-hidden', 'true'));
    expect(screen.getAllByTestId('set-album-card-circle')).toHaveLength(LINCOLN.length);
  });

  it('shows the ✓ owned mark only on owned coins, so ownership is not colour-only', () => {
    renderAlbum();
    const marks = screen.getAllByTestId('set-album-card-owned-mark');
    // plain, svdb, 1931d are owned
    expect(marks).toHaveLength(3);
    marks.forEach((m) => expect(m.textContent).toBe('✓'));
    expect(within(cardByCoin('coin-plain')).getByTestId('set-album-card-owned-mark')).toBeInTheDocument();
    expect(within(cardByCoin('coin-vdb')).queryByTestId('set-album-card-owned-mark')).not.toBeInTheDocument();
    expect(within(cardByCoin('coin-1931s')).queryByTestId('set-album-card-owned-mark')).not.toBeInTheDocument();
  });

  it('shows the owned mark on an image circle too', () => {
    const owned = slot(0, 'imgowned', { year: 1909, imageUrl: 'https://example.com/a.jpg', owned: true });
    const missing = slot(1, 'imgmissing', { year: 1910, imageUrl: 'https://example.com/b.jpg', owned: false });
    renderAlbum({ slots: [owned, missing] });
    expect(within(cardByCoin('coin-imgowned')).getByTestId('set-album-card-owned-mark')).toBeInTheDocument();
    expect(within(cardByCoin('coin-imgmissing')).queryByTestId('set-album-card-owned-mark')).not.toBeInTheDocument();
  });
});

describe('SetAlbum: legend', () => {
  it('explains the new visuals', () => {
    renderAlbum();
    const legend = screen.getByTestId('set-album-legend');
    expect(legend).toHaveTextContent('Owned');
    expect(legend).toHaveTextContent('Missing');
    expect(legend).toHaveTextContent('Key date');
    expect(legend).toHaveTextContent('★');
  });

  it('shows the "Not in this set" item only when some page has blank cells', () => {
    const { unmount } = renderAlbum();
    expect(screen.getByTestId('set-album-legend-blank')).toHaveTextContent('Not in this set');
    unmount();

    renderAlbum({ slots: WAS });
    expect(screen.queryByTestId('set-album-legend-blank')).not.toBeInTheDocument();
    expect(screen.getByTestId('set-album-legend')).not.toHaveTextContent('Not in this set');
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
  it('renders a round button per card for the owner, at least 32px', () => {
    renderAlbum();
    const buttons = screen.getAllByTestId('set-album-card-check');
    expect(buttons).toHaveLength(LINCOLN.length);
    buttons.forEach((b) => {
      expect(b.tagName).toBe('BUTTON');
      expect(b).toHaveAttribute('type', 'button');
      expect(b.className).toContain('h-8');
      expect(b.className).toContain('w-8');
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
});

describe('SetAlbum: Missing filter (gapOnly)', () => {
  it('keeps every card, cell and blank cell, and mutes only owned cards', () => {
    renderAlbum({ gapOnly: true });

    expect(screen.getAllByTestId('set-album-card')).toHaveLength(LINCOLN.length);
    expect(screen.getAllByTestId('set-album-blank-cell')).toHaveLength(2);
    expect(screen.getAllByTestId('set-album-cell')).toHaveLength(4);
    expect(cardByCoin('coin-plain')).toHaveAttribute('data-muted', 'true');
    expect(cardByCoin('coin-svdb')).toHaveAttribute('data-muted', 'true');
    expect(cardByCoin('coin-vdb')).toHaveAttribute('data-muted', 'false');
    expect(cardByCoin('coin-1931s')).toHaveAttribute('data-muted', 'false');
  });

  it('mutes owned cards on a grid page too', () => {
    renderAlbum({ slots: WAS, gapOnly: true });
    expect(cardByCoin('coin-luhansk')).toHaveAttribute('data-muted', 'true');
    expect(cardByCoin('coin-donetsk')).toHaveAttribute('data-muted', 'false');
  });

  it('mutes nothing when gapOnly is false', () => {
    renderAlbum({ gapOnly: false });
    screen.getAllByTestId('set-album-card').forEach((s) => expect(s).toHaveAttribute('data-muted', 'false'));
  });

  it('muted cards are still interactive for the owner', async () => {
    const user = userEvent.setup();
    const { onToggle } = renderAlbum({ gapOnly: true });

    await user.click(checkByCoin('coin-plain'));

    expect(onToggle).toHaveBeenCalledWith('coin-plain', true);
    expect(within(cardByCoin('coin-plain')).getByTestId('set-album-card-link')).toHaveAttribute(
      'href',
      '/catalog/coin-plain',
    );
  });

  it('keeps counts unchanged by the filter', () => {
    renderAlbum({ gapOnly: true });
    expect(screen.getByTestId('set-album-page-count').textContent).toBe('3 of 5 owned');
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
