/**
 * Tests for: DELETE /auth/account (e2e)
 * Contract source: runs/run_20261001_214421/plan.md § Interface Contract → E2E: apps/api/test/account-deletion.e2e-spec.ts
 * Covers criteria: #1, #2, #3, #5, #6, #7, #8, #9, #17 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Hits the real test database via AppModule/PrismaService, like the other e2e specs.
 * Throttle budget: 2 registers, 3 logins, 4 DELETE /auth/account calls (limit 5/min each).
 */

import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

function extractRefreshCookie(res: request.Response): string {
  const setCookie = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  const raw = setCookie.find((c) => c.startsWith('refreshToken='));
  if (!raw) {
    throw new Error('No refreshToken cookie found in Set-Cookie header');
  }
  return raw.split(';')[0];
}

describe('DELETE /auth/account (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const emailA = `e2e-acct-del-a-${stamp}@example.com`;
  const emailB = `e2e-acct-del-b-${stamp}@example.com`;
  const password = 'correct-horse-battery-staple';

  let tokenA: string;
  let tokenB: string;
  let cookieA: string;
  let userAId: string;
  let userBId: string;
  let coinId: string;
  let aSetId: string;
  let bCloneId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const http = () => request(app.getHttpServer());

    await http().post('/api/v1/auth/register').send({ email: emailA, password }).expect(201);
    await http().post('/api/v1/auth/register').send({ email: emailB, password }).expect(201);

    const loginA = await http().post('/api/v1/auth/login').send({ email: emailA, password }).expect(200);
    tokenA = loginA.body.accessToken;
    cookieA = extractRefreshCookie(loginA);
    const loginB = await http().post('/api/v1/auth/login').send({ email: emailB, password }).expect(200);
    tokenB = loginB.body.accessToken;

    userAId = (await prisma.user.findUniqueOrThrow({ where: { email: emailA } })).id;
    userBId = (await prisma.user.findUniqueOrThrow({ where: { email: emailB } })).id;

    const coinRes = await http()
      .post('/api/v1/catalog')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        country: 'USA',
        denomination: '1 Cent',
        name: `E2E Account Deletion Coin ${stamp}`,
        year: 1955,
        variety: `e2e-acct-del-${stamp}`,
      })
      .expect(201);
    coinId = coinRes.body.id;

    await http()
      .patch(`/api/v1/collection/${coinId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ owned: true })
      .expect(200);

    const setRes = await http()
      .post('/api/v1/sets')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ name: `E2E acct-del set ${stamp}` })
      .expect(201);
    aSetId = setRes.body.id;

    await http()
      .patch(`/api/v1/sets/${aSetId}/coins`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ add: [coinId] })
      .expect(200);

    const cloneRes = await http()
      .post('/api/v1/sets')
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ name: `E2E acct-del clone ${stamp}`, cloneFrom: { type: 'user', id: aSetId } })
      .expect(201);
    bCloneId = cloneRes.body.id;
  });

  afterAll(async () => {
    // Guard id-keyed cleanup: Prisma ignores `undefined` filters, so an unset id
    // (beforeAll failed early) would otherwise match every row in the shared DB.
    const userIds = [userAId, userBId].filter((id): id is string => Boolean(id));
    if (coinId) {
      await prisma.ownership.deleteMany({ where: { coinId } });
      await prisma.userSetCoin.deleteMany({ where: { coinId } });
    }
    if (userIds.length > 0) {
      await prisma.userSet.deleteMany({ where: { userId: { in: userIds } } });
      await prisma.ownership.deleteMany({ where: { userId: { in: userIds } } });
    }
    if (coinId) {
      await prisma.coin.deleteMany({ where: { id: coinId } });
    }
    await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
    await app.close();
  });

  it('rejects a missing token with 401', async () => {
    await request(app.getHttpServer()).delete('/api/v1/auth/account').send({ password }).expect(401);
  });

  it('rejects an empty password with 400', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/auth/account')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ password: '' })
      .expect(400);
  });

  it('wrong password gives 401 and leaves all of A\'s data intact', async () => {
    await request(app.getHttpServer())
      .delete('/api/v1/auth/account')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ password: 'wrong-password' })
      .expect(401);

    expect(await prisma.user.findUnique({ where: { id: userAId } })).not.toBeNull();
    expect(await prisma.userSet.findUnique({ where: { id: aSetId } })).not.toBeNull();
    expect(await prisma.ownership.findFirst({ where: { userId: userAId, coinId } })).not.toBeNull();
    const coin = await prisma.coin.findUnique({ where: { id: coinId } });
    expect(coin?.submittedByUserId).toBe(userAId);
  });

  describe('after a correct-password deletion', () => {
    it('returns 204 and clears the refresh cookie', async () => {
      const res = await request(app.getHttpServer())
        .delete('/api/v1/auth/account')
        .set('Authorization', `Bearer ${tokenA}`)
        .set('Cookie', cookieA)
        .send({ password })
        .expect(204);

      const setCookie = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
      const cleared = setCookie.find((c) => c.startsWith('refreshToken='));
      expect(cleared).toBeDefined();
      expect(cleared).toMatch(/^refreshToken=;/);
      expect(res.text).toBe('');
    });

    it('removes the user and their personal data', async () => {
      expect(await prisma.user.findUnique({ where: { id: userAId } })).toBeNull();
      expect(await prisma.userSet.findUnique({ where: { id: aSetId } })).toBeNull();
      expect(await prisma.ownership.findFirst({ where: { userId: userAId } })).toBeNull();
    });

    it('login with the old credentials gives 401', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: emailA, password }).expect(401);
    });

    it('the old refresh cookie is rejected with 401', async () => {
      await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Cookie', cookieA).expect(401);
    });

    it('the old access token gets 401 on /auth/me', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${tokenA}`)
        .expect(401);
    });

    it('A\'s set is absent from GET /sets/public and its detail gives 404', async () => {
      const seen: string[] = [];
      let total = Infinity;
      for (let page = 1; seen.length < total; page++) {
        const res = await request(app.getHttpServer())
          .get('/api/v1/sets/public')
          .query({ page, limit: 100 })
          .expect(200);
        total = res.body.total;
        const items = res.body.items as Array<{ id: string }>;
        if (items.length === 0) break;
        seen.push(...items.map((item) => item.id));
      }
      expect(seen).not.toContain(aSetId);

      await request(app.getHttpServer()).get(`/api/v1/sets/public/${aSetId}`).expect(404);
    });

    it('A\'s submitted coin still exists with no submitter', async () => {
      const coin = await prisma.coin.findUnique({ where: { id: coinId } });
      expect(coin).not.toBeNull();
      expect(coin?.submittedByUserId).toBeNull();
    });

    it('B\'s clone survives with clonedFromUserSetId null and keeps its coin row', async () => {
      const clone = await prisma.userSet.findUnique({ where: { id: bCloneId } });
      expect(clone).not.toBeNull();
      expect(clone?.clonedFromUserSetId).toBeNull();
      expect(await prisma.userSetCoin.count({ where: { userSetId: bCloneId } })).toBeGreaterThan(0);
    });
  });
});
