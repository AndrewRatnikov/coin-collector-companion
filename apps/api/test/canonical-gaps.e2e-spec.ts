/**
 * Tests for: GET /sets/canonical/:id/gaps (e2e) and GET /sets/:id/gaps regression
 * Contract source: runs/run_20261108_173105/plan.md § Interface Contract (HTTP contract)
 * Covers criteria: #1-#9, #11, #12 (from runs/run_20261108_173105/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Needs a live DATABASE_URL, so it only runs in Verify's `api e2e` step (throwaway DB).
 */

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const SETS = '/api/v1/sets';

async function buildApp(): Promise<NestExpressApplication> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

describe('Canonical checklist gaps (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const country = `E2E Canonical Gaps ${stamp}`;
  const password = 'correct-horse-battery-staple';
  const email = `e2e-canon-gaps-${stamp}@example.com`;
  const otherEmail = `e2e-canon-gaps-other-${stamp}@example.com`;
  const unknownId = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

  let token: string;
  let userId: string;
  let otherUserId: string;
  let coinA: string;
  let coinB: string;
  let coinC: string;
  let canonicalId: string;
  let emptyCanonicalId: string;
  let userSetId: string;
  let slotIds: Record<string, string> = {};

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
    ({ userId: otherUserId } = await register(otherEmail));

    const base = { country, denomination: 'Cent', variety: '', status: 'approved' as const, mintMark: '' };
    coinA = (await prisma.coin.create({ data: { ...base, year: 1950, name: 'Alpha Piece' } })).id;
    coinB = (await prisma.coin.create({ data: { ...base, year: 1951, name: 'Bravo Piece' } })).id;
    coinC = (await prisma.coin.create({ data: { ...base, year: 1952, name: 'Charlie Piece' } })).id;

    // Positions deliberately out of insertion order: C=1, A=2, B=3.
    const canonical = await prisma.canonicalSet.create({
      data: {
        name: `E2E Canonical ${stamp}`,
        source: 'admin',
        templateVersion: 'e2e',
        coins: {
          create: [
            { coinId: coinB, position: 3 },
            { coinId: coinC, position: 1 },
            { coinId: coinA, position: 2 },
          ],
        },
      },
      include: { coins: true },
    });
    canonicalId = canonical.id;
    slotIds = Object.fromEntries(canonical.coins.map((c) => [c.coinId, c.id]));

    emptyCanonicalId = (
      await prisma.canonicalSet.create({
        data: { name: `E2E Canonical Empty ${stamp}`, source: 'admin', templateVersion: 'e2e' },
      })
    ).id;

    // Caller owns A (graded XF). The other user owns B and C, which must be ignored for the caller.
    await prisma.ownership.create({ data: { userId, coinId: coinA, grade: 'XF' } });
    await prisma.ownership.createMany({
      data: [
        { userId: otherUserId, coinId: coinB, grade: 'UNC' },
        { userId: otherUserId, coinId: coinC },
      ],
    });

    userSetId = (
      await prisma.userSet.create({
        data: {
          userId,
          name: 'E2E Regression Set',
          minGrade: 'VF',
          coins: {
            create: [
              { coinId: coinA, position: 1 },
              { coinId: coinB, position: 2 },
            ],
          },
        },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.ownership.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    await prisma.userSet.deleteMany({ where: { userId: { in: [userId, otherUserId] } } });
    await prisma.canonicalSet.deleteMany({ where: { id: { in: [canonicalId, emptyCanonicalId] } } });
    await prisma.coin.deleteMany({ where: { country } });
    await prisma.user.deleteMany({ where: { email: { in: [email, otherEmail] } } });
    await app.close();
  });

  describe('errors', () => {
    it('returns 401 without a token', async () => {
      await request(app.getHttpServer()).get(`${SETS}/canonical/${canonicalId}/gaps`).expect(401);
    });

    it('returns 400 for a non-UUID id', async () => {
      await request(app.getHttpServer()).get(`${SETS}/canonical/not-a-uuid/gaps`).set(auth(token)).expect(400);
    });

    it('returns 404 for an unknown checklist id', async () => {
      await request(app.getHttpServer()).get(`${SETS}/canonical/${unknownId}/gaps`).set(auth(token)).expect(404);
    });
  });

  describe('200', () => {
    it('returns counts, position-ordered slots, the caller grade and ignores other users', async () => {
      const res = await request(app.getHttpServer())
        .get(`${SETS}/canonical/${canonicalId}/gaps`)
        .set(auth(token))
        .expect(200);

      expect(res.body).toMatchObject({
        setId: canonicalId,
        ownedCount: 1,
        totalCount: 3,
        completionPercent: 33,
        minGrade: null,
      });
      expect(res.body).not.toHaveProperty('upgradeCount');

      const slots = res.body.slots;
      expect(slots.map((s: { position: number }) => s.position)).toEqual([1, 2, 3]);
      expect(slots.map((s: { coin: { id: string } }) => s.coin.id)).toEqual([coinC, coinA, coinB]);
      expect(slots.map((s: { id: string }) => s.id)).toEqual([slotIds[coinC], slotIds[coinA], slotIds[coinB]]);
      expect(slots.map((s: { owned: boolean }) => s.owned)).toEqual([false, true, false]);
      expect(slots.map((s: { grade: string | null }) => s.grade)).toEqual([null, 'XF', null]);
      for (const slot of slots) {
        expect(slot).not.toHaveProperty('needsUpgrade');
        expect(slot.coin).not.toHaveProperty('submittedByUserId');
        expect(slot.coin).not.toHaveProperty('ownerships');
      }
    });

    it('gives the other user their own, different view of the same checklist', async () => {
      const other = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: otherEmail, password });
      const res = await request(app.getHttpServer())
        .get(`${SETS}/canonical/${canonicalId}/gaps`)
        .set(auth(other.body.accessToken))
        .expect(200);

      expect(res.body).toMatchObject({ ownedCount: 2, totalCount: 3, completionPercent: 67 });
      expect(res.body.slots.map((s: { owned: boolean }) => s.owned)).toEqual([true, false, true]);
    });

    it('returns totalCount 0 and completionPercent 0 for an empty checklist', async () => {
      const res = await request(app.getHttpServer())
        .get(`${SETS}/canonical/${emptyCanonicalId}/gaps`)
        .set(auth(token))
        .expect(200);

      expect(res.body).toMatchObject({ setId: emptyCanonicalId, totalCount: 0, ownedCount: 0, completionPercent: 0 });
      expect(res.body.slots).toEqual([]);
    });
  });

  describe('regression: GET /sets/:id/gaps', () => {
    it('still returns minGrade, upgradeCount and per-slot needsUpgrade for a user set with a minGrade', async () => {
      const res = await request(app.getHttpServer()).get(`${SETS}/${userSetId}/gaps`).set(auth(token)).expect(200);

      expect(res.body).toMatchObject({ setId: userSetId, minGrade: 'VF', ownedCount: 1, totalCount: 2 });
      expect(res.body).toHaveProperty('upgradeCount');
      for (const slot of res.body.slots) {
        expect(slot).toHaveProperty('needsUpgrade');
      }
    });
  });
});
