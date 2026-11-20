/**
 * Tests for: apps/api/scripts/retention-report.ts
 * Contract source: runs/run_20261120_225014/plan.md § Interface Contract → Script: retention-report
 * Covers criteria: #15 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * PrismaClient is mocked with a plain object that has user.findMany only, so the report can neither
 * write nor reach a real database. `main()` is not exported and is not tested here.
 */

import {
  bucketRetention,
  formatRetentionTable,
  isoWeekKey,
  loadRetentionInput,
  type RetentionPrismaClient,
  type RetentionRow,
  type RetentionUserInput,
} from './retention-report';

function utc(iso: string): Date {
  return new Date(`${iso}T12:00:00.000Z`);
}

describe('retention-report', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isoWeekKey', () => {
    it.each([
      ['2026-01-01', '2026-W01'],
      ['2025-12-29', '2026-W01'],
      ['2027-01-01', '2026-W53'],
      ['2026-12-31', '2026-W53'],
      ['2024-12-30', '2025-W01'],
      ['2026-01-04', '2026-W01'],
      ['2026-01-05', '2026-W02'],
      ['2026-11-20', '2026-W47'],
    ])('maps %s to %s', (day, week) => {
      expect(isoWeekKey(utc(day))).toBe(week);
    });

    it('pads the week number to two digits', () => {
      expect(isoWeekKey(utc('2026-02-10'))).toBe('2026-W07');
    });

    it('works in UTC: late Sunday and early Monday fall in different weeks', () => {
      expect(isoWeekKey(new Date('2025-12-28T23:59:59.000Z'))).toBe('2025-W52');
      expect(isoWeekKey(new Date('2025-12-29T00:00:00.000Z'))).toBe('2026-W01');
    });
  });

  describe('bucketRetention', () => {
    const users: RetentionUserInput[] = [
      // signed up in 2026-W02, no ownerships
      { createdAt: utc('2026-01-07'), ownedAt: [] },
      // signed up in 2026-W01, exactly five ownerships, all in one week
      {
        createdAt: utc('2026-01-01'),
        ownedAt: [utc('2026-01-01'), utc('2026-01-01'), utc('2026-01-02'), utc('2026-01-02'), utc('2026-01-03')],
      },
      // signed up in 2026-W01, four ownerships spread over two weeks
      {
        createdAt: utc('2026-01-02'),
        ownedAt: [utc('2026-01-02'), utc('2026-01-03'), utc('2026-01-08'), utc('2026-01-09')],
      },
    ];

    it('returns no rows for no users', () => {
      expect(bucketRetention([])).toEqual([]);
    });

    it('makes one row per sign-up week, sorted ascending, whatever the input order', () => {
      const rows = bucketRetention(users);

      expect(rows.map((r) => r.week)).toEqual(['2026-W01', '2026-W02']);
      expect(rows.map((r) => r.users)).toEqual([2, 1]);
    });

    it('counts 5+ owned for exactly five rows but not four', () => {
      const rows = bucketRetention(users);

      expect(rows[0].withFiveOwned).toBe(1);
      expect(rows[1].withFiveOwned).toBe(0);
    });

    it('counts owned-in-two-weeks for ownerships in 2 weeks but not for 5 rows in the same week', () => {
      const rows = bucketRetention(users);

      // the four-ownership user spans two weeks; the five-ownership user stays in one
      expect(rows[0].ownedInTwoWeeks).toBe(1);
      expect(rows[1].ownedInTwoWeeks).toBe(0);
    });

    it('buckets by sign-up week, not by ownership week', () => {
      const rows = bucketRetention([{ createdAt: utc('2026-01-01'), ownedAt: [utc('2026-03-01'), utc('2026-04-01')] }]);

      expect(rows).toEqual([{ week: '2026-W01', users: 1, withFiveOwned: 0, ownedInTwoWeeks: 1 }]);
    });

    it('counts five ownerships over two weeks in both measures', () => {
      const rows = bucketRetention([
        {
          createdAt: utc('2026-01-01'),
          ownedAt: [utc('2026-01-01'), utc('2026-01-02'), utc('2026-01-03'), utc('2026-01-08'), utc('2026-01-09')],
        },
      ]);

      expect(rows).toEqual([{ week: '2026-W01', users: 1, withFiveOwned: 1, ownedInTwoWeeks: 1 }]);
    });
  });

  describe('formatRetentionTable', () => {
    const rows: RetentionRow[] = [
      { week: '2026-W01', users: 12, withFiveOwned: 5, ownedInTwoWeeks: 3 },
      { week: '2026-W02', users: 8, withFiveOwned: 2, ownedInTwoWeeks: 1 },
    ];

    it('has the header, one line per week and a Total line', () => {
      const lines = formatRetentionTable(rows).split('\n');

      expect(lines[0]).toBe('Sign-up week  Users  5+ owned  Owned in 2+ weeks');
      expect(lines).toHaveLength(4);
      expect(lines[1]).toMatch(/^\s*2026-W01\s+12\s+5\s+3\s*$/);
      expect(lines[2]).toMatch(/^\s*2026-W02\s+8\s+2\s+1\s*$/);
    });

    it('sums the three counts on the Total line', () => {
      const lines = formatRetentionTable(rows).split('\n');

      expect(lines[3]).toMatch(/^Total\s+20\s+7\s+4\s*$/);
    });

    it('totals follow the rows it was given', () => {
      const lines = formatRetentionTable([{ week: '2026-W10', users: 1, withFiveOwned: 0, ownedInTwoWeeks: 0 }]).split(
        '\n',
      );

      expect(lines[lines.length - 1]).toMatch(/^Total\s+1\s+0\s+0\s*$/);
    });

    it('contains no email address', () => {
      const text = formatRetentionTable(bucketRetention([{ createdAt: utc('2026-01-01'), ownedAt: [] }]));

      expect(text).not.toContain('@');
    });
  });

  describe('loadRetentionInput', () => {
    function makePrisma(rows: unknown) {
      const findMany = jest.fn().mockResolvedValue(rows);
      const prisma = { user: { findMany } } as unknown as RetentionPrismaClient;
      return { prisma, findMany };
    }

    it('selects dates only: no id or email at the top level', async () => {
      const { prisma, findMany } = makePrisma([]);

      await loadRetentionInput(prisma);

      expect(findMany).toHaveBeenCalledTimes(1);
      const arg = findMany.mock.calls[0][0] as { select: Record<string, unknown> };
      expect(Object.keys(arg.select).sort()).toEqual(['createdAt', 'ownerships']);
      expect(arg.select).not.toHaveProperty('id');
      expect(arg.select).not.toHaveProperty('email');
      expect(JSON.stringify(arg)).not.toMatch(/"(id|email|userId|coinId)"/);
    });

    it('maps createdAt and the ownership dates, and drops everything else', async () => {
      const created = utc('2026-01-01');
      const owned1 = utc('2026-01-02');
      const owned2 = utc('2026-01-09');
      const { prisma } = makePrisma([
        { createdAt: created, ownerships: [{ ownedAt: owned1 }, { ownedAt: owned2 }] },
        { createdAt: utc('2026-02-01'), ownerships: [] },
      ]);

      const input = await loadRetentionInput(prisma);

      expect(input).toEqual([
        { createdAt: created, ownedAt: [owned1, owned2] },
        { createdAt: utc('2026-02-01'), ownedAt: [] },
      ]);
    });

    it('works against a client that can only read users', async () => {
      const { prisma } = makePrisma([]);

      expect(Object.keys(prisma.user)).toEqual(['findMany']);
      await expect(loadRetentionInput(prisma)).resolves.toEqual([]);
    });
  });
});
