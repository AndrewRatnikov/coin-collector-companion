/**
 * Tests for: GET /sets (progress fields) and GET /sets/summary (e2e)
 * Contract source: runs/run_20261018_105617/plan.md § Interface Contract (API: GET /api/v1/sets,
 *                   API: GET /api/v1/sets/summary, Test notes)
 * Covers criteria: #2, #3 (from runs/run_20261018_105617/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Needs a live DATABASE_URL, so it only runs in Verify's `api e2e` step (throwaway DB), like the other
 * *.e2e-spec.ts files. Two users are registered through the real /auth endpoints; coins (unique country),
 * sets and ownership are created directly through PrismaService and everything is deleted in afterAll.
 * The suggestion is not asserted here: other e2e suites may create canonical sets in the same DB, so it is
 * covered by the unit tests in sets.service.spec.ts.
 */

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const SETS = '/api/v1/sets';
const SUMMARY = '/api/v1/sets/summary';

async function buildApp(): Promise<NestExpressApplication> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

describe('Sets list progress and summary (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const country = `E2E Sets Summary ${stamp}`;
  const password = 'correct-horse-battery-staple';
  const email = `e2e-sets-summary-${stamp}@example.com`;
  const freshEmail = `e2e-sets-summary-fresh-${stamp}@example.com`;

  let token: string;
  let freshToken: string;
  let userId: string;
  let freshUserId: string;
  let coinA: string; // owned, in set one
  let coinB: string; // missing, in set one and set two
  let coinC: string; // missing, in set one
  let coinD: string; // missing, in set two
  let setOneId: string;
  let setTwoId: string;
  let setEmptyId: string;

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

  beforeAll(async () => {
    app = await buildApp();
    prisma = app.get(PrismaService);

    ({ token, userId } = await register(email));
    ({ token: freshToken, userId: freshUserId } = await register(freshEmail));

    const base = { country, denomination: 'Cent', variety: '', status: 'approved' as const };
    coinA = (await prisma.coin.create({ data: { ...base, year: 1950, mintMark: '', name: 'Alpha Piece' } })).id;
    coinB = (await prisma.coin.create({ data: { ...base, year: 1951, mintMark: '', name: 'Bravo Piece' } })).id;
    coinC = (await prisma.coin.create({ data: { ...base, year: 1952, mintMark: '', name: 'Charlie Piece' } })).id;
    coinD = (await prisma.coin.create({ data: { ...base, year: 1953, mintMark: '', name: 'Delta Piece' } })).id;

    await prisma.ownership.create({ data: { userId, coinId: coinA } });

    // Created one after another so createdAt ascending is one, two, empty.
    setOneId = (
      await prisma.userSet.create({
        data: {
          userId,
          name: 'E2E Set One',
          coins: {
            create: [
              { coinId: coinA, position: 1 },
              { coinId: coinB, position: 2 },
              { coinId: coinC, position: 3 },
            ],
          },
        },
      })
    ).id;
    setTwoId = (
      await prisma.userSet.create({
        data: {
          userId,
          name: 'E2E Set Two',
          coins: {
            create: [
              { coinId: coinB, position: 1 },
              { coinId: coinD, position: 2 },
            ],
          },
        },
      })
    ).id;
    setEmptyId = (await prisma.userSet.create({ data: { userId, name: 'E2E Set Empty' } })).id;
  });

  afterAll(async () => {
    await prisma.ownership.deleteMany({ where: { userId: { in: [userId, freshUserId] } } });
    await prisma.userSet.deleteMany({ where: { userId: { in: [userId, freshUserId] } } });
    await prisma.coin.deleteMany({ where: { country } });
    await prisma.user.deleteMany({ where: { email: { in: [email, freshEmail] } } });
    await app.close();
  });

  describe('authentication', () => {
    it('GET /sets/summary without a token returns 401', async () => {
      await request(app.getHttpServer()).get(SUMMARY).expect(401);
    });
  });

  describe('GET /sets (criterion #2)', () => {
    it('returns ownedCount, totalCount and firstMissing per set in creation order, with the existing fields and no coins key', async () => {
      const res = await request(app.getHttpServer()).get(SETS).set(auth(token)).expect(200);

      expect(res.body.map((s: { id: string }) => s.id)).toEqual([setOneId, setTwoId, setEmptyId]);

      const [one, two, empty] = res.body;
      expect(one).toMatchObject({
        id: setOneId,
        userId,
        name: 'E2E Set One',
        clonedFromCanonicalId: null,
        clonedFromUserSetId: null,
        ownedCount: 1,
        totalCount: 3,
        firstMissing: 'Bravo Piece',
      });
      expect(two).toMatchObject({ id: setTwoId, ownedCount: 0, totalCount: 2, firstMissing: 'Bravo Piece' });
      expect(empty).toMatchObject({ id: setEmptyId, ownedCount: 0, totalCount: 0, firstMissing: null });
      for (const item of res.body) {
        expect(item).not.toHaveProperty('coins');
        expect(typeof item.createdAt).toBe('string');
        expect(typeof item.updatedAt).toBe('string');
      }
    });

    it('reports a complete set with firstMissing null', async () => {
      await prisma.ownership.createMany({
        data: [
          { userId, coinId: coinB },
          { userId, coinId: coinC },
        ],
      });

      const res = await request(app.getHttpServer()).get(SETS).set(auth(token)).expect(200);
      const one = res.body.find((s: { id: string }) => s.id === setOneId);
      expect(one).toMatchObject({ ownedCount: 3, totalCount: 3, firstMissing: null });
      const two = res.body.find((s: { id: string }) => s.id === setTwoId);
      expect(two).toMatchObject({ ownedCount: 1, totalCount: 2, firstMissing: 'Delta Piece' });

      await prisma.ownership.deleteMany({ where: { userId, coinId: { in: [coinB, coinC] } } });
    });

    it('does not include another user\'s sets', async () => {
      const res = await request(app.getHttpServer()).get(SETS).set(auth(freshToken)).expect(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /sets/summary (criterion #3)', () => {
    it('counts a coin missing from two sets once and returns the collection size', async () => {
      const res = await request(app.getHttpServer()).get(SUMMARY).set(auth(token)).expect(200);

      // Missing slots: B and C from set one, B and D from set two -> B counted once = 3 unique coins.
      expect(res.body.uniqueMissingCount).toBe(3);
      expect(res.body.collectionCount).toBe(1);
      expect(res.body).toHaveProperty('suggestedSet');
    });

    it('reflects ownership changes (owning the shared coin lowers the unique count by one)', async () => {
      await prisma.ownership.create({ data: { userId, coinId: coinB } });

      const res = await request(app.getHttpServer()).get(SUMMARY).set(auth(token)).expect(200);
      expect(res.body.uniqueMissingCount).toBe(2);
      expect(res.body.collectionCount).toBe(2);

      await prisma.ownership.delete({ where: { userId_coinId: { userId, coinId: coinB } } });
    });

    it('returns uniqueMissingCount 0 for a user with no sets', async () => {
      const res = await request(app.getHttpServer()).get(SUMMARY).set(auth(freshToken)).expect(200);

      expect(res.body.uniqueMissingCount).toBe(0);
      expect(res.body.collectionCount).toBe(0);
    });
  });
});
