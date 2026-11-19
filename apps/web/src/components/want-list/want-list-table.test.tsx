/**
 * Tests for: WantListTable
 * Contract source: runs/run_20261119_210926/plan.md § Interface Contract → Component: WantListTable
 * Covers criteria: #3, #5 (from prd.md)
 *
 * CONTRACT_GAPs: none
 */

import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { WantListTable } from '@/components/want-list/want-list-table';
import type { WantGroup } from '@/lib/missing-list';
import en from '@/lib/i18n/locales/en';

const USA_GROUP: WantGroup = {
  key: 'USA|1 Cent',
  country: 'USA',
  denomination: '1 Cent',
  years: [
    {
      year: 1914,
      mints: [
        { label: 'D', isKeyDate: true },
        { label: 'S', isKeyDate: false },
      ],
    },
    { year: 1909, mints: [{ label: 'S VDB', isKeyDate: true }] },
  ],
};

const UKRAINE_GROUP: WantGroup = {
  key: 'Ukraine|5 Kopiyok',
  country: 'Ukraine',
  denomination: '5 Kopiyok',
  years: [{ year: 2011, mints: [{ label: 'Donetsk Oblast', isKeyDate: false }] }],
};

describe('WantListTable: structure', () => {
  it('renders the root with the variant, one group per group and one row per year', () => {
    render(<WantListTable groups={[USA_GROUP, UKRAINE_GROUP]} plainLabel="(plain)" variant="missing" />);

    const root = screen.getByTestId('want-list-table');
    expect(root).toHaveAttribute('data-variant', 'missing');
    const groups = screen.getAllByTestId('want-list-group');
    expect(groups.map((g) => g.getAttribute('data-group-key'))).toEqual(['USA|1 Cent', 'Ukraine|5 Kopiyok']);
    expect(within(groups[0]).getAllByTestId('want-list-row')).toHaveLength(2);
    expect(within(groups[1]).getAllByTestId('want-list-row')).toHaveLength(1);
  });

  it('sets data-variant to upgrade for the upgrade variant', () => {
    render(<WantListTable groups={[USA_GROUP]} plainLabel="(plain)" variant="upgrade" />);

    expect(screen.getByTestId('want-list-table')).toHaveAttribute('data-variant', 'upgrade');
  });

  it('renders the year in a th and the mints in a td, with data-year on the row, in input order', () => {
    render(<WantListTable groups={[USA_GROUP]} plainLabel="(plain)" variant="missing" />);

    const rows = screen.getAllByTestId('want-list-row');
    expect(rows.map((r) => r.getAttribute('data-year'))).toEqual(['1914', '1909']);
    expect(rows[0].tagName).toBe('TR');
    const years = screen.getAllByTestId('want-list-year');
    expect(years.map((y) => y.textContent)).toEqual(['1914', '1909']);
    expect(years[0].tagName).toBe('TH');
    expect(screen.getAllByTestId('want-list-mints')[0].tagName).toBe('TD');
  });

  it('joins the mints of a year with " · " and stars key dates only', () => {
    render(<WantListTable groups={[USA_GROUP]} plainLabel="(plain)" variant="missing" />);

    const mints = screen.getAllByTestId('want-list-mints');
    expect(mints[0]).toHaveTextContent(/^D ★ · S$/);
    expect(mints[1]).toHaveTextContent(/^S VDB ★$/);
  });

  it('renders the root with no groups for an empty array', () => {
    render(<WantListTable groups={[]} plainLabel="(plain)" variant="missing" />);

    expect(screen.getByTestId('want-list-table')).toBeInTheDocument();
    expect(screen.queryAllByTestId('want-list-group')).toHaveLength(0);
    expect(screen.queryAllByTestId('want-list-row')).toHaveLength(0);
  });

  it('puts className on the root', () => {
    render(<WantListTable groups={[USA_GROUP]} plainLabel="(plain)" variant="missing" className="mt-3" />);

    expect(screen.getByTestId('want-list-table')).toHaveClass('mt-3');
  });
});

describe('WantListTable: group headings', () => {
  it('hides the heading for a single group by default', () => {
    render(<WantListTable groups={[USA_GROUP]} plainLabel="(plain)" variant="missing" />);

    expect(screen.queryByTestId('want-list-group-heading')).not.toBeInTheDocument();
  });

  it('shows a "country · denomination" h3 per group for two or more groups by default', () => {
    render(<WantListTable groups={[USA_GROUP, UKRAINE_GROUP]} plainLabel="(plain)" variant="missing" />);

    const headings = screen.getAllByTestId('want-list-group-heading');
    expect(headings.map((h) => h.textContent)).toEqual(['USA · 1 Cent', 'Ukraine · 5 Kopiyok']);
    expect(headings[0].tagName).toBe('H3');
  });

  it('showGroupHeadings overrides the default in both directions', () => {
    const { unmount } = render(
      <WantListTable groups={[USA_GROUP]} showGroupHeadings plainLabel="(plain)" variant="missing" />,
    );
    expect(screen.getByTestId('want-list-group-heading')).toHaveTextContent('USA · 1 Cent');
    unmount();

    render(
      <WantListTable
        groups={[USA_GROUP, UKRAINE_GROUP]}
        showGroupHeadings={false}
        plainLabel="(plain)"
        variant="missing"
      />,
    );
    expect(screen.queryByTestId('want-list-group-heading')).not.toBeInTheDocument();
  });
});

describe('WantListTable: plain label', () => {
  it('renders plainLabel for a mint with an empty label and follows the prop', () => {
    const group: WantGroup = {
      ...USA_GROUP,
      years: [{ year: 1911, mints: [{ label: '', isKeyDate: false }] }],
    };
    const { unmount } = render(<WantListTable groups={[group]} plainLabel="(plain)" variant="missing" />);
    expect(screen.getByTestId('want-list-mints')).toHaveTextContent(/^\(plain\)$/);
    unmount();

    render(<WantListTable groups={[group]} plainLabel="(sin ceca)" variant="missing" />);
    expect(screen.getByTestId('want-list-mints')).toHaveTextContent(/^\(sin ceca\)$/);
  });

  it('stars a plain key-date mint', () => {
    const group: WantGroup = {
      ...USA_GROUP,
      years: [{ year: 1911, mints: [{ label: '', isKeyDate: true }] }],
    };
    render(<WantListTable groups={[group]} plainLabel="(plain)" variant="missing" />);

    expect(screen.getByTestId('want-list-mints')).toHaveTextContent(/^\(plain\) ★$/);
  });
});

describe('WantListTable: upgrade variant', () => {
  const UPGRADE_GROUP: WantGroup = {
    key: 'USA|1 Cent',
    country: 'USA',
    denomination: '1 Cent',
    years: [
      {
        year: 1914,
        mints: [
          { label: 'D', isKeyDate: true, grade: 'F', targetGrade: 'VF' },
          { label: 'S', isKeyDate: false, grade: 'VG', targetGrade: 'VF' },
        ],
      },
      { year: 1911, mints: [{ label: '', isKeyDate: false, grade: null, targetGrade: 'VF' }] },
    ],
  };

  it('appends "(from → to)" with the short grade labels after the label and star', () => {
    render(<WantListTable groups={[UPGRADE_GROUP]} plainLabel="(plain)" variant="upgrade" />);

    expect(screen.getAllByTestId('want-list-mints')[0]).toHaveTextContent(/^D ★ \(F → VF\) · S \(VG → VF\)$/);
  });

  it('reads "no grade" for an ungraded coin, using the localized missingList.noGrade', () => {
    render(<WantListTable groups={[UPGRADE_GROUP]} plainLabel="(plain)" variant="upgrade" />);

    expect(screen.getAllByTestId('want-list-mints')[1]).toHaveTextContent(
      `(plain) (${en['missingList.noGrade']} → VF)`,
    );
  });

  it('shows no grades in the missing variant even when the mint carries them', () => {
    render(<WantListTable groups={[UPGRADE_GROUP]} plainLabel="(plain)" variant="missing" />);

    const text = screen.getAllByTestId('want-list-mints')[0].textContent ?? '';
    expect(text).toBe('D ★ · S');
    expect(text).not.toContain('→');
  });

  it('uses the target grade of each mint', () => {
    const group: WantGroup = {
      ...UPGRADE_GROUP,
      years: [{ year: 1920, mints: [{ label: 'D', isKeyDate: false, grade: 'G', targetGrade: 'XF' }] }],
    };
    render(<WantListTable groups={[group]} plainLabel="(plain)" variant="upgrade" />);

    expect(screen.getByTestId('want-list-mints')).toHaveTextContent(/^D \(G → XF\)$/);
  });

  it('adds no arrow to an upgrade mint without a targetGrade', () => {
    const group: WantGroup = {
      ...UPGRADE_GROUP,
      years: [{ year: 1920, mints: [{ label: 'D', isKeyDate: false }] }],
    };
    render(<WantListTable groups={[group]} plainLabel="(plain)" variant="upgrade" />);

    expect(screen.getByTestId('want-list-mints').textContent).toBe('D');
  });
});
