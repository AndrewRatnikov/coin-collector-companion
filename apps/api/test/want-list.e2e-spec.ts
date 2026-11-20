/**
 * Tests for: GET /sets/wants (e2e)
 * Contract source: runs/run_20261120_211112/plan.md § Interface Contract (Endpoint: GET /api/v1/sets/wants, Test notes)
 * Covers criteria: #2, #4, #5, #6, #8, #10, #11, #13 (from runs/run_20261120_211112/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Needs a live DATABASE_URL, so it only runs in Verify's `api e2e` step (throwaway DB), like the other
 * *.e2e-spec.ts files. Users are registered through the real /auth endpoints; coins (unique country), sets and
 * ownership are created through PrismaService and everything is deleted in afterAll. Other suites share the DB,
 * so assertions on the main user are scoped to this suite's own country; the fresh user gets whole-body equality.
 */

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const WANTS = '/api/v1/sets/wants';
const SUMMARY = '/api/v1/sets/summary';
const SETS = '/api/v1/sets';

interface WantEntry {
  coin: { id: string; country: string; [key: string]: unknown };
  sets: { id: string; name: string }[];
  grade?: string | null;
  targetGrade?: string;
}

async function buildApp(): Promise<NestExpressApplication> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

describe('Combined want list (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const country = `E2E Want List ${stamp}`;
  const otherCountry = `E2E Want List Other ${stamp}`;
  const password = 'correct-horse-battery-staple';
  const emailA = `e2e-want-a-${stamp}@example.com`;
  const emailB = `e2e-want-b-${stamp}@example.com`;
  const emailFresh = `e2e-want-fresh-${stamp}@example.com`;

  let tokenA: string;
  let tokenB: string;
  let tokenFresh: string;
  let userA: string;
  let userB: string;
  let userFresh: string;
  let coinShared: string; // missing for A, in set one and set two (submitted by A)
  let coinSolo: string; // missing for A, in set one only
  let coinOwnedLow: string; // owned by A at F, set two requires VF -> upgrade
  let coinOwnedFine: string; // owned by A at AU, set two requires VF -> neither list
  let coinOfB: string; // only in B's set
  let setOneId: string;
  let setTwoId: string;
  let setEmptyId: string;
  let setBId: string;

  const auth = (value: string) => ({ Authorization: `Bearer ${value}` });

  async function register(address: string): Promise<{ token: string; userId: string }> {
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: address, password }).expect(201);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: address, password })
      .expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: address } });
    return { token: login.body.accessToken, userId: user.id };
  }

  const own = (list: WantEntry[], c: string): WantEntry[] => list.filter((entry) => entry.coin.country === c);

  beforeAll(async () => {
    app = await buildApp();
    prisma = app.get(PrismaService);

    ({ token: tokenA, userId: userA } = await register(emailA));
    ({ token: tokenB, userId: userB } = await register(emailB));
    ({ token: tokenFresh, userId: userFresh } = await register(emailFresh));

    const base = { country, denomination: 'Cent', variety: '', mintMark: '', status: 'approved' as const };
    coinShared = (
      await prisma.coin.create({ data: { ...base, year: 1950, name: 'Shared Piece', submittedByUserId: userA } })
    ).id;
    coinSolo = (await prisma.coin.create({ data: { ...base, year: 1951, name: 'Solo Piece' } })).id;
    coinOwnedLow = (await prisma.coin.create({ data: { ...base, year: 1952, name: 'Low Piece' } })).id;
    coinOwnedFine = (await prisma.coin.create({ data: { ...base, year: 1953, name: 'Fine Piece' } })).id;
    coinOfB = (
      await prisma.coin.create({ data: { ...base, country: otherCountry, year: 1960, name: 'B Piece' } })
    ).id;

    await prisma.ownership.createMany({
      data: [
        { userId: userA, coinId: coinOwnedLow, grade: 'F' },
        { userId: userA, coinId: coinOwnedFine, grade: 'AU' },
        // B owns the coin A is missing and has their own set with a minimum.
        { userId: userB, coinId: coinShared },
        { userId: userB, coinId: coinOfB, grade: 'G' },
      ],
    });

    setOneId = (
      await prisma.userSet.create({
        data: {
          userId: userA,
          name: 'E2E Want Set One',
          coins: {
            create: [
              { coinId: coinShared, position: 1 },
              { coinId: coinSolo, position: 2 },
            ],
          },
        },
      })
    ).id;
    setTwoId = (
      await prisma.userSet.create({
        data: {
          userId: userA,
          name: 'E2E Want Set Two',
          minGrade: 'VF',
          coins: {
            create: [
              { coinId: coinShared, position: 1 },
              { coinId: coinOwnedLow, position: 2 },
              { coinId: coinOwnedFine, position: 3 },
            ],
          },
        },
      })
    ).id;
    setEmptyId = (await prisma.userSet.create({ data: { userId: userA, name: 'E2E Want Set Empty' } })).id;
    setBId = (
      await prisma.userSet.create({
        data: {
          userId: userB,
          name: 'E2E Want Set B',
          minGrade: 'UNC',
          coins: { create: [{ coinId: coinOfB, position: 1 }] },
        },
      })
    ).id;
  });

  afterAll(async () => {
    const users = [userA, userB, userFresh];
    await prisma.ownership.deleteMany({ where: { userId: { in: users } } });
    await prisma.userSet.deleteMany({ where: { userId: { in: users } } });
    await prisma.coin.deleteMany({ where: { country: { in: [country, otherCountry] } } });
    await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB, emailFresh] } } });
    await app.close();
  });

  describe('authentication', () => {
    it('GET /sets/wants without a token returns 401', async () => {
      await request(app.getHttpServer()).get(WANTS).expect(401);
    });

    it('GET /sets/wants with an invalid token returns 401', async () => {
      await request(app.getHttpServer()).get(WANTS).set(auth('not-a-token')).expect(401);
    });
  });

  describe('response', () => {
    it('lists each missing coin once with every containing set, and the upgrade with its failing set', async () => {
      const res = await request(app.getHttpServer()).get(WANTS).set(auth(tokenA)).expect(200);

      expect(res.body.setCount).toBe(3);

      const missing = own(res.body.missing, country);
      expect(missing.map((m) => m.coin.id)).toEqual([coinShared, coinSolo]);
      expect(missing[0].sets).toEqual([
        { id: setOneId, name: 'E2E Want Set One' },
        { id: setTwoId, name: 'E2E Want Set Two' },
      ]);
      expect(missing[1].sets).toEqual([{ id: setOneId, name: 'E2E Want Set One' }]);

      const upgrades = own(res.body.upgrades, country);
      expect(upgrades).toHaveLength(1);
      expect(upgrades[0].coin.id).toBe(coinOwnedLow);
      expect(upgrades[0].grade).toBe('F');
      expect(upgrades[0].targetGrade).toBe('VF');
      expect(upgrades[0].sets).toEqual([{ id: setTwoId, name: 'E2E Want Set Two' }]);

      // Owned at AU against a VF minimum: in neither list.
      const listed = [...res.body.missing, ...res.body.upgrades].map((e: WantEntry) => e.coin.id);
      expect(listed).not.toContain(coinOwnedFine);
      // A coin is never in both lists.
      const missingIds = new Set(res.body.missing.map((e: WantEntry) => e.coin.id));
      for (const u of res.body.upgrades as WantEntry[]) expect(missingIds.has(u.coin.id)).toBe(false);
    });

    it('returns coins shaped by CATALOG_COIN_SELECT with no submittedByUserId', async () => {
      const res = await request(app.getHttpServer()).get(WANTS).set(auth(tokenA)).expect(200);

      const entries = [...own(res.body.missing, country), ...own(res.body.upgrades, country)];
      expect(entries.length).toBeGreaterThan(0);
      // coinShared was submitted by A, so the column is set in the database.
      expect(entries.some((e) => e.coin.id === coinShared)).toBe(true);
      for (const entry of entries) {
        expect(entry.coin).not.toHaveProperty('submittedByUserId');
        expect(entry.coin).not.toHaveProperty('rejectionReason');
        expect(entry.coin).toHaveProperty('country');
        expect(entry.coin).toHaveProperty('denomination');
      }
    });

    it('a fresh user with no sets gets 200 and an empty response', async () => {
      const res = await request(app.getHttpServer()).get(WANTS).set(auth(tokenFresh)).expect(200);
      expect(res.body).toEqual({ setCount: 0, missing: [], upgrades: [] });
    });
  });

  describe('isolation', () => {
    it("never includes another user's sets or coins, and a coin B owns is still missing for A", async () => {
      const res = await request(app.getHttpServer()).get(WANTS).set(auth(tokenA)).expect(200);
      const all: WantEntry[] = [...res.body.missing, ...res.body.upgrades];

      const setIds = new Set(all.flatMap((e) => e.sets.map((s) => s.id)));
      expect(setIds.has(setBId)).toBe(false);
      expect([...setIds].every((id) => [setOneId, setTwoId, setEmptyId].includes(id))).toBe(true);
      expect(all.map((e) => e.coin.id)).not.toContain(coinOfB);
      expect(res.body.missing.map((e: WantEntry) => e.coin.id)).toContain(coinShared);
    });

    it("B's response contains B's own set and upgrade only", async () => {
      const res = await request(app.getHttpServer()).get(WANTS).set(auth(tokenB)).expect(200);

      expect(res.body.setCount).toBe(1);
      const upgrades = own(res.body.upgrades, otherCountry);
      expect(upgrades).toHaveLength(1);
      expect(upgrades[0]).toMatchObject({ grade: 'G', targetGrade: 'UNC', sets: [{ id: setBId, name: 'E2E Want Set B' }] });
      expect(res.body.missing.map((e: WantEntry) => e.coin.id)).not.toContain(coinShared);
    });
  });

  describe('agreement with GET /sets/summary', () => {
    it('missing.length equals uniqueMissingCount, with a coin missing from two sets and upgrades present', async () => {
      const wants = await request(app.getHttpServer()).get(WANTS).set(auth(tokenA)).expect(200);
      const summary = await request(app.getHttpServer()).get(SUMMARY).set(auth(tokenA)).expect(200);

      expect(wants.body.upgrades.length).toBeGreaterThan(0);
      expect(wants.body.missing).toHaveLength(2);
      expect(wants.body.missing.length).toBe(summary.body.uniqueMissingCount);
    });

    it('stays equal after the caller acquires a coin', async () => {
      await prisma.ownership.create({ data: { userId: userA, coinId: coinSolo } });
      try {
        const wants = await request(app.getHttpServer()).get(WANTS).set(auth(tokenA)).expect(200);
        const summary = await request(app.getHttpServer()).get(SUMMARY).set(auth(tokenA)).expect(200);
        expect(wants.body.missing).toHaveLength(1);
        expect(wants.body.missing.length).toBe(summary.body.uniqueMissingCount);
      } finally {
        await prisma.ownership.delete({ where: { userId_coinId: { userId: userA, coinId: coinSolo } } });
      }
    });

    it('both are zero for a user with no sets', async () => {
      const wants = await request(app.getHttpServer()).get(WANTS).set(auth(tokenFresh)).expect(200);
      const summary = await request(app.getHttpServer()).get(SUMMARY).set(auth(tokenFresh)).expect(200);
      expect(wants.body.missing.length).toBe(summary.body.uniqueMissingCount);
      expect(wants.body.missing).toHaveLength(0);
    });
  });

  describe('no route shadowing', () => {
    it('GET /sets/wants resolves to the want list, not a UUID validation error', async () => {
      const res = await request(app.getHttpServer()).get(WANTS).set(auth(tokenA)).expect(200);
      expect(res.body).toHaveProperty('setCount');
      expect(Array.isArray(res.body.missing)).toBe(true);
      expect(Array.isArray(res.body.upgrades)).toBe(true);
    });

    it('GET /sets/:id/gaps still returns the set', async () => {
      const res = await request(app.getHttpServer()).get(`${SETS}/${setOneId}/gaps`).set(auth(tokenA)).expect(200);
      expect(res.body.setId).toBe(setOneId);
    });

    it('PATCH /sets/:id still renames the set', async () => {
      const res = await request(app.getHttpServer())
        .patch(`${SETS}/${setEmptyId}`)
        .set(auth(tokenA))
        .send({ name: 'E2E Want Set Empty' })
        .expect(200);
      expect(res.body.name).toBe('E2E Want Set Empty');
    });

    it('GET /sets/summary still returns 200', async () => {
      await request(app.getHttpServer()).get(SUMMARY).set(auth(tokenA)).expect(200);
    });
  });
});
