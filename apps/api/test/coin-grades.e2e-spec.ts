/**
 * Tests for: coin grades end to end (PATCH /collection/:coinId, PATCH /collection, GET /collection,
 * PATCH /sets/:id, POST /sets clone, GET /sets, GET /sets/public/:id, GET /sets/:id/gaps)
 * Contract source: runs/run_20261102_194108/plan.md § Interface Contract (E2E: coin-grades.e2e-spec.ts)
 * Covers criteria: #5, #6, #7, #8, #9, #10, #11, #12, #13, #14, #15 (from runs/run_20261102_194108/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Needs a live DATABASE_URL, so it only runs in Verify's `api e2e` step (throwaway DB), like the other
 * *.e2e-spec.ts files. The real ValidationPipe is installed through configureApp. Two users are registered
 * through the real /auth endpoints; coins (unique country) and the owner's set are created through
 * PrismaService, and everything is deleted in afterAll. The tests are sequential and share state on purpose
 * (they follow the step order of the plan).
 */

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const API = '/api/v1';
const COLLECTION = `${API}/collection`;
const SETS = `${API}/sets`;

interface GapSlotBody {
  coin: { id: string };
  owned: boolean;
  grade: string | null;
  needsUpgrade?: boolean;
}

async function buildApp(): Promise<NestExpressApplication> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

describe('Coin grades (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const country = `E2E Coin Grades ${stamp}`;
  const password = 'correct-horse-battery-staple';
  const ownerEmail = `e2e-coin-grades-owner-${stamp}@example.com`;
  const otherEmail = `e2e-coin-grades-other-${stamp}@example.com`;

  let ownerToken: string;
  let otherToken: string;
  let ownerId: string;
  let otherId: string;
  let coinA: string;
  let coinB: string;
  let coinC: string;
  let setId: string;
  let baseline: { ownedCount: number; totalCount: number; completionPercent: number };

  const auth = (value: string) => ({ Authorization: `Bearer ${value}` });

  async function register(address: string): Promise<{ token: string; userId: string }> {
    await request(app.getHttpServer()).post(`${API}/auth/register`).send({ email: address, password }).expect(201);
    const login = await request(app.getHttpServer())
      .post(`${API}/auth/login`)
      .send({ email: address, password })
      .expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email: address } });
    return { token: login.body.accessToken, userId: user.id };
  }

  function patchCoin(token: string, coinId: string, body: Record<string, unknown>) {
    return request(app.getHttpServer()).patch(`${COLLECTION}/${coinId}`).set(auth(token)).send(body);
  }

  async function getGaps(token: string) {
    const res = await request(app.getHttpServer()).get(`${SETS}/${setId}/gaps`).set(auth(token)).expect(200);
    const slots: GapSlotBody[] = res.body.slots;
    const slotFor = (coinId: string) => slots.find((s) => s.coin.id === coinId) as GapSlotBody;
    return { body: res.body, slots, slotFor };
  }

  beforeAll(async () => {
    app = await buildApp();
    prisma = app.get(PrismaService);

    ({ token: ownerToken, userId: ownerId } = await register(ownerEmail));
    ({ token: otherToken, userId: otherId } = await register(otherEmail));

    const base = { country, denomination: 'Cent', variety: '', status: 'approved' as const };
    coinA = (await prisma.coin.create({ data: { ...base, year: 1960, mintMark: '', name: 'Alpha Piece' } })).id;
    coinB = (await prisma.coin.create({ data: { ...base, year: 1961, mintMark: '', name: 'Bravo Piece' } })).id;
    coinC = (await prisma.coin.create({ data: { ...base, year: 1962, mintMark: '', name: 'Charlie Piece' } })).id;

    setId = (
      await prisma.userSet.create({
        data: {
          userId: ownerId,
          name: 'E2E Grades Set',
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
  });

  afterAll(async () => {
    const userIds = [ownerId, otherId];
    await prisma.ownership.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.userSetCoin.deleteMany({ where: { userSet: { userId: { in: userIds } } } });
    await prisma.userSet.deleteMany({ where: { userId: { in: userIds } } });
    await prisma.coin.deleteMany({ where: { country } });
    await prisma.user.deleteMany({ where: { email: { in: [ownerEmail, otherEmail] } } });
    await app.close();
  });

  it('step 1: marking a coin owned without a grade returns grade null (criterion #6)', async () => {
    const res = await patchCoin(ownerToken, coinA, { owned: true }).expect(200);

    expect(res.body).toMatchObject({ coinId: coinA, owned: true, grade: null });
  });

  it('step 2: sets a grade, then re-marking owned without grade keeps it (criterion #5)', async () => {
    const graded = await patchCoin(ownerToken, coinA, { owned: true, grade: 'VF' }).expect(200);
    expect(graded.body).toMatchObject({ coinId: coinA, owned: true, grade: 'VF' });

    const kept = await patchCoin(ownerToken, coinA, { owned: true }).expect(200);
    expect(kept.body.grade).toBe('VF');
  });

  it('step 3: bulk PATCH ignores grade and never changes an existing one (criteria #7, #9)', async () => {
    await request(app.getHttpServer())
      .patch(COLLECTION)
      .set(auth(ownerToken))
      .send({ coinIds: [coinA, coinB], owned: true, grade: 'G' })
      .expect(200);

    const res = await request(app.getHttpServer()).get(COLLECTION).set(auth(ownerToken)).expect(200);
    const byCoin = (id: string) => res.body.find((item: { coinId: string }) => item.coinId === id);

    expect(byCoin(coinA).grade).toBe('VF');
    expect(byCoin(coinB).grade).toBeNull();
  });

  it('step 4: an invalid grade is a 400 and does not change the stored grade (criterion #8)', async () => {
    await patchCoin(ownerToken, coinA, { owned: true, grade: 'Proof' }).expect(400);
    await patchCoin(ownerToken, coinA, { owned: true, grade: 'vf' }).expect(400);
    await patchCoin(ownerToken, coinA, { owned: true, grade: 7 }).expect(400);

    const res = await patchCoin(ownerToken, coinA, { owned: true }).expect(200);
    expect(res.body.grade).toBe('VF');
  });

  it('step 5: a set without a minGrade has no needsUpgrade or upgradeCount keys (criterion #11)', async () => {
    const { body, slots, slotFor } = await getGaps(ownerToken);

    baseline = {
      ownedCount: body.ownedCount,
      totalCount: body.totalCount,
      completionPercent: body.completionPercent,
    };
    expect(baseline).toEqual({ ownedCount: 2, totalCount: 3, completionPercent: 67 });
    expect(body.minGrade).toBeNull();
    expect(body).not.toHaveProperty('upgradeCount');
    for (const slot of slots) {
      expect(slot).not.toHaveProperty('needsUpgrade');
    }
    expect(slotFor(coinA).grade).toBe('VF');
    expect(slotFor(coinB).grade).toBeNull();
  });

  it('step 6: minGrade is owner-only and validated (criteria #8, #12)', async () => {
    await request(app.getHttpServer())
      .patch(`${SETS}/${setId}`)
      .set(auth(otherToken))
      .send({ minGrade: 'XF' })
      .expect(403);

    await request(app.getHttpServer())
      .patch(`${SETS}/${setId}`)
      .set(auth(ownerToken))
      .send({ minGrade: 'bogus' })
      .expect(400);

    const res = await request(app.getHttpServer())
      .patch(`${SETS}/${setId}`)
      .set(auth(ownerToken))
      .send({ minGrade: 'XF' })
      .expect(200);
    expect(res.body.minGrade).toBe('XF');
    expect(res.body.name).toBe('E2E Grades Set');
  });

  it('step 6b: an empty body, a null name and a canonical-style unknown id are rejected', async () => {
    await request(app.getHttpServer()).patch(`${SETS}/${setId}`).set(auth(ownerToken)).send({}).expect(400);
    await request(app.getHttpServer())
      .patch(`${SETS}/${setId}`)
      .set(auth(ownerToken))
      .send({ name: null })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`${SETS}/3fa85f64-5717-4562-b3fc-2c963f66afa6`)
      .set(auth(ownerToken))
      .send({ minGrade: 'XF' })
      .expect(404);
  });

  it('step 7: the owner gap view flags slots below the minimum and keeps completion unchanged (criteria #10, #11, #15)', async () => {
    const { body, slotFor } = await getGaps(ownerToken);

    expect(body.minGrade).toBe('XF');
    expect(slotFor(coinA)).toMatchObject({ owned: true, grade: 'VF', needsUpgrade: true });
    expect(slotFor(coinB)).toMatchObject({ owned: true, grade: null, needsUpgrade: true });
    expect(slotFor(coinC)).toMatchObject({ owned: false, grade: null, needsUpgrade: false });
    expect(body.upgradeCount).toBe(2);
    expect(body.ownedCount).toBe(baseline.ownedCount);
    expect(body.totalCount).toBe(baseline.totalCount);
    expect(body.completionPercent).toBe(baseline.completionPercent);
  });

  it('step 8: raising a coin to UNC lowers upgradeCount, completion stays equal (criterion #15)', async () => {
    await patchCoin(ownerToken, coinA, { owned: true, grade: 'UNC' }).expect(200);

    const { body, slotFor } = await getGaps(ownerToken);

    expect(slotFor(coinA)).toMatchObject({ grade: 'UNC', needsUpgrade: false });
    expect(body.upgradeCount).toBe(1);
    expect(body.completionPercent).toBe(baseline.completionPercent);
    expect(body.ownedCount).toBe(baseline.ownedCount);
  });

  it("step 9: another user's gap view is computed against their own ownership (criterion #11)", async () => {
    const { body, slots } = await getGaps(otherToken);

    expect(body.minGrade).toBe('XF');
    expect(slots).toHaveLength(3);
    for (const slot of slots) {
      expect(slot.owned).toBe(false);
      expect(slot.grade).toBeNull();
      expect(slot.needsUpgrade).toBe(false);
    }
    expect(body.upgradeCount).toBe(0);
    expect(body.ownedCount).toBe(0);
  });

  it('step 10: a clone does not copy minGrade (criterion #14)', async () => {
    const res = await request(app.getHttpServer())
      .post(SETS)
      .set(auth(otherToken))
      .send({ name: 'E2E Grades Clone', cloneFrom: { type: 'user', id: setId } })
      .expect(201);

    expect(res.body.minGrade).toBeNull();
    expect(res.body.userId).toBe(otherId);
  });

  it('step 11: GET /sets and GET /sets/public/:id carry minGrade (criterion #13)', async () => {
    const list = await request(app.getHttpServer()).get(SETS).set(auth(ownerToken)).expect(200);
    const mine = list.body.find((s: { id: string }) => s.id === setId);
    expect(mine.minGrade).toBe('XF');

    const detail = await request(app.getHttpServer()).get(`${SETS}/public/${setId}`).expect(200);
    expect(detail.body.minGrade).toBe('XF');
  });

  it('step 12: minGrade null clears the goal and the gap view drops the upgrade keys (criterion #12)', async () => {
    const res = await request(app.getHttpServer())
      .patch(`${SETS}/${setId}`)
      .set(auth(ownerToken))
      .send({ minGrade: null })
      .expect(200);
    expect(res.body.minGrade).toBeNull();

    const { body, slots } = await getGaps(ownerToken);
    expect(body.minGrade).toBeNull();
    expect(body).not.toHaveProperty('upgradeCount');
    for (const slot of slots) {
      expect(slot).not.toHaveProperty('needsUpgrade');
    }
  });

  it('step 13: un-owning deletes the grade, so re-owning starts at null (criterion #5)', async () => {
    const removed = await patchCoin(ownerToken, coinA, { owned: false, grade: 'XF' }).expect(200);
    expect(removed.body).toMatchObject({ coinId: coinA, owned: false, ownedAt: null, grade: null });

    const again = await patchCoin(ownerToken, coinA, { owned: true }).expect(200);
    expect(again.body).toMatchObject({ coinId: coinA, owned: true, grade: null });
  });
});
