import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

// Read-only week-two retention report: users bucketed by the ISO week they signed up in, how many
// marked at least 5 coins owned, and how many marked coins owned in two different ISO weeks.
// Prints only week keys and counts: no emails, no ids.

// A structural subset of PrismaClient: tests pass a plain mock with only `user.findMany`.
export type RetentionPrismaClient = Pick<PrismaClient, 'user'>;

export interface RetentionUserInput {
  createdAt: Date;
  ownedAt: Date[];
}

export interface RetentionRow {
  week: string;
  users: number;
  withFiveOwned: number;
  ownedInTwoWeeks: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** ISO-8601 week of `date` in UTC, as `YYYY-Www` (two-digit week). */
export function isoWeekKey(date: Date): string {
  const day = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // Monday = 1 ... Sunday = 7; move to the Thursday of the same ISO week, whose year is the ISO year.
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const isoYear = day.getUTCFullYear();
  const yearStart = Date.UTC(isoYear, 0, 1);
  const week = Math.ceil(((day.getTime() - yearStart) / DAY_MS + 1) / 7);
  return `${isoYear}-W${String(week).padStart(2, '0')}`;
}

export function bucketRetention(users: RetentionUserInput[]): RetentionRow[] {
  const byWeek = new Map<string, RetentionRow>();
  for (const user of users) {
    const week = isoWeekKey(user.createdAt);
    let row = byWeek.get(week);
    if (!row) {
      row = { week, users: 0, withFiveOwned: 0, ownedInTwoWeeks: 0 };
      byWeek.set(week, row);
    }
    row.users += 1;
    if (user.ownedAt.length >= 5) row.withFiveOwned += 1;
    if (new Set(user.ownedAt.map(isoWeekKey)).size >= 2) row.ownedInTwoWeeks += 1;
  }
  return [...byWeek.values()].sort((a, b) => (a.week < b.week ? -1 : a.week > b.week ? 1 : 0));
}

const HEADERS = ['Sign-up week', 'Users', '5+ owned', 'Owned in 2+ weeks'] as const;

export function formatRetentionTable(rows: RetentionRow[]): string {
  const total = rows.reduce(
    (sum, row) => ({
      users: sum.users + row.users,
      withFiveOwned: sum.withFiveOwned + row.withFiveOwned,
      ownedInTwoWeeks: sum.ownedInTwoWeeks + row.ownedInTwoWeeks,
    }),
    { users: 0, withFiveOwned: 0, ownedInTwoWeeks: 0 },
  );
  const cells: string[][] = [
    ...rows.map((row) => [row.week, String(row.users), String(row.withFiveOwned), String(row.ownedInTwoWeeks)]),
    ['Total', String(total.users), String(total.withFiveOwned), String(total.ownedInTwoWeeks)],
  ];
  const widths = HEADERS.map((header, column) =>
    Math.max(header.length, ...cells.map((line) => line[column].length)),
  );
  // The first column is left-aligned so the Total line starts at column 0; counts are right-aligned.
  const formatLine = (line: readonly string[]) =>
    line
      .map((cell, column) => (column === 0 ? cell.padEnd(widths[column]) : cell.padStart(widths[column])))
      .join('  ')
      .trimEnd();
  return [HEADERS.join('  '), ...cells.map(formatLine)].join('\n');
}

export async function loadRetentionInput(prisma: RetentionPrismaClient): Promise<RetentionUserInput[]> {
  const users = await prisma.user.findMany({
    select: { createdAt: true, ownerships: { select: { ownedAt: true } } },
  });
  return users.map((user) => ({
    createdAt: user.createdAt,
    ownedAt: user.ownerships.map((ownership) => ownership.ownedAt),
  }));
}

async function main(): Promise<void> {
  // Prisma 7 neither loads .env nor connects without a driver adapter: read apps/api/.env
  // when it exists (environment variables take precedence), then connect through PrismaPg.
  const envFile = join(__dirname, '..', '.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    console.log(formatRetentionTable(bucketRetention(await loadRetentionInput(prisma))));
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
