/**
 * Tests for: GET /admin/coins and PATCH /admin/coins/:id (e2e)
 * Contract source: runs/run_20261001_224939/plan.md § Interface Contract → E2E: admin-coins
 * Covers criteria: #3, #6, #7, #8, #9, #10, #12, #13, #14, #15 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Hits the real test database via AppModule/PrismaService, like the other e2e specs. Three
 * throwaway users are registered and logged in (admin, plain user, submitter): 3 registers and
 * 3 logins, inside the 5/min throttle. The admin is promoted directly through Prisma. Pending
 * coins are created directly through Prisma (avoids the 20/hour POST /catalog throttle) with
 * unique stamps in name and variety. Everything created here is removed in afterAll, scoped to
 * the ids/emails this spec created.
 *
 * The demotion test is deliberately the LAST test in the file: it changes the admin's role.
 */

import { NestExpressApplication } from '@nestjs/platform-express';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const UNKNOWN_COIN_ID = '3fa85f64-5717-4562-b3fc-2c963f66afa6';

describe('admin coins (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const adminEmail = `e2e-admin-coins-admin-${stamp}@example.com`;
  const plainEmail = `e2e-admin-coins-plain-${stamp}@example.com`;
  const submitterEmail = `e2e-admin-coins-submitter-${stamp}@example.com`;
  const password = 'correct-horse-battery-staple';

  let adminToken: string;
  let plainToken: string;
  let submitterToken: string;
  let adminId: string;
  let plainId: string;
  let submitterId: string;

  const createdCoinIds: string[] = [];

  const names = {
    approve: `E2E AdminReview ${stamp} approve`,
    reject: `E2E AdminReview ${stamp} reject`,
    guarded: `E2E AdminReview ${stamp} guarded`,
    collide: `E2E AdminReview ${stamp} collide`,
    existing: `E2E AdminReview ${stamp} existing`,
    ignore: `E2E AdminReview ${stamp} ignore`,
    demote: `E2E AdminReview ${stamp} demote`,
  };

  let approveId: string;
  let rejectId: string;
  let guardedId: string;
  let collideId: string;
  let existingId: string;
  let ignoreId: string;
  let demoteId: string;

  const REJECTION_REASON = `Photo is too blurry to verify ${stamp}`;

  const http = () => request(app.getHttpServer());

  async function createCoin(
    tag: keyof typeof names,
    status: 'pending' | 'approved',
    submittedByUserId: string | null,
    year: number,
  ): Promise<string> {
    const coin = await prisma.coin.create({
      data: {
        country: 'USA',
        denomination: `E2E AdminReview ${stamp}`,
        year,
        mintMark: '',
        variety: `e2e-admin-${stamp}-${tag}`,
        name: names[tag],
        status,
        submittedByUserId,
        submittedAt: submittedByUserId ? new Date() : null,
      },
    });
    createdCoinIds.push(coin.id);
    return coin.id;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    await http().post('/api/v1/auth/register').send({ email: adminEmail, password }).expect(201);
    await http().post('/api/v1/auth/register').send({ email: plainEmail, password }).expect(201);
    await http().post('/api/v1/auth/register').send({ email: submitterEmail, password }).expect(201);

    adminToken = (await http().post('/api/v1/auth/login').send({ email: adminEmail, password }).expect(200)).body
      .accessToken;
    plainToken = (await http().post('/api/v1/auth/login').send({ email: plainEmail, password }).expect(200)).body
      .accessToken;
    submitterToken = (await http().post('/api/v1/auth/login').send({ email: submitterEmail, password }).expect(200))
      .body.accessToken;

    adminId = (await prisma.user.findUniqueOrThrow({ where: { email: adminEmail } })).id;
    plainId = (await prisma.user.findUniqueOrThrow({ where: { email: plainEmail } })).id;
    submitterId = (await prisma.user.findUniqueOrThrow({ where: { email: submitterEmail } })).id;

    await prisma.user.update({ where: { id: adminId }, data: { role: 'admin' } });

    approveId = await createCoin('approve', 'pending', submitterId, 1901);
    rejectId = await createCoin('reject', 'pending', submitterId, 1902);
    guardedId = await createCoin('guarded', 'pending', submitterId, 1903);
    collideId = await createCoin('collide', 'pending', submitterId, 1904);
    existingId = await createCoin('existing', 'approved', null, 1904);
    ignoreId = await createCoin('ignore', 'pending', submitterId, 1905);
    demoteId = await createCoin('demote', 'pending', submitterId, 1906);
  });

  afterAll(async () => {
    // Guard id-keyed cleanup: Prisma ignores `undefined` filters, so an unset list or id
    // (beforeAll failed early) must never widen the delete.
    if (createdCoinIds.length > 0) {
      await prisma.coin.deleteMany({ where: { id: { in: createdCoinIds } } });
    }
    await prisma.user.deleteMany({ where: { email: { in: [adminEmail, plainEmail, submitterEmail] } } });
    await app.close();
  });

  describe('GET /admin/coins access control (criteria #3, #6)', () => {
    it('rejects a missing token with 401', async () => {
      await http().get('/api/v1/admin/coins?status=pending').expect(401);
    });

    it('rejects a plain user with 403', async () => {
      await http().get('/api/v1/admin/coins?status=pending').set('Authorization', `Bearer ${plainToken}`).expect(403);
    });

    it('rejects the submitter (also a plain user) with 403', async () => {
      await http()
        .get('/api/v1/admin/coins?status=pending')
        .set('Authorization', `Bearer ${submitterToken}`)
        .expect(403);
    });

    it('returns 200 with a paginated list for the admin', async () => {
      const res = await http()
        .get('/api/v1/admin/coins?status=pending&limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body).toEqual(
        expect.objectContaining({ page: 1, limit: 100, total: expect.any(Number), items: expect.any(Array) }),
      );
    });
  });

  describe('GET /admin/coins content (criteria #6, #7, #14)', () => {
    it('lists the pending coin with the submitter email and no submittedByUserId', async () => {
      const res = await http()
        .get('/api/v1/admin/coins?status=pending&limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const items = res.body.items as Array<Record<string, unknown>>;
      const item = items.find((i) => i.id === guardedId);
      expect(item).toBeDefined();
      expect(item?.submitterEmail).toBe(submitterEmail);
      expect(item?.status).toBe('pending');
      expect(item).not.toHaveProperty('submittedByUserId');
      expect(item).not.toHaveProperty('submitter');
      expect(item).toHaveProperty('possibleDuplicate');
    });

    it('lists only the requested status: approved coins are absent from the pending list', async () => {
      const res = await http()
        .get('/api/v1/admin/coins?status=pending&limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = (res.body.items as Array<{ id: string }>).map((i) => i.id);
      expect(ids).not.toContain(existingId);
    });

    it('lists newest first: a coin created later appears before one created earlier', async () => {
      const res = await http()
        .get('/api/v1/admin/coins?status=pending&limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const ids = (res.body.items as Array<{ id: string }>).map((i) => i.id);
      expect(ids.indexOf(demoteId)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(approveId)).toBeGreaterThanOrEqual(0);
      expect(ids.indexOf(demoteId)).toBeLessThan(ids.indexOf(approveId));
    });
  });

  describe('PATCH /admin/coins/:id access control (criteria #3, #8)', () => {
    it('rejects a missing token with 401 and leaves the coin pending', async () => {
      await http().patch(`/api/v1/admin/coins/${guardedId}`).send({ status: 'approved' }).expect(401);

      expect((await prisma.coin.findUniqueOrThrow({ where: { id: guardedId } })).status).toBe('pending');
    });

    it('rejects a plain user with 403 and leaves the coin pending', async () => {
      await http()
        .patch(`/api/v1/admin/coins/${guardedId}`)
        .set('Authorization', `Bearer ${plainToken}`)
        .send({ status: 'approved' })
        .expect(403);

      expect((await prisma.coin.findUniqueOrThrow({ where: { id: guardedId } })).status).toBe('pending');
    });

    it('rejects the submitter approving their own coin with 403', async () => {
      await http()
        .patch(`/api/v1/admin/coins/${guardedId}`)
        .set('Authorization', `Bearer ${submitterToken}`)
        .send({ status: 'approved' })
        .expect(403);

      expect((await prisma.coin.findUniqueOrThrow({ where: { id: guardedId } })).status).toBe('pending');
    });

    it('rejects a reason sent with approved as 400 and leaves the coin pending', async () => {
      await http()
        .patch(`/api/v1/admin/coins/${guardedId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved', rejectionReason: 'should not be allowed' })
        .expect(400);

      expect((await prisma.coin.findUniqueOrThrow({ where: { id: guardedId } })).status).toBe('pending');
    });

    it('rejects an over-long reason as 400', async () => {
      await http()
        .patch(`/api/v1/admin/coins/${guardedId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'rejected', rejectionReason: 'x'.repeat(501) })
        .expect(400);

      expect((await prisma.coin.findUniqueOrThrow({ where: { id: guardedId } })).status).toBe('pending');
    });

    it('rejects a non-UUID id as 400', async () => {
      await http()
        .patch('/api/v1/admin/coins/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' })
        .expect(400);
    });
  });

  describe('approve (criteria #8, #9, #12, #17)', () => {
    it('returns 200 for the admin, applies edits together with the status change, and hides submittedByUserId', async () => {
      const res = await http()
        .patch(`/api/v1/admin/coins/${approveId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved', name: `${names.approve} (edited)`, year: 1911 })
        .expect(200);

      expect(res.body.id).toBe(approveId);
      expect(res.body.status).toBe('approved');
      expect(res.body.name).toBe(`${names.approve} (edited)`);
      expect(res.body.year).toBe(1911);
      expect(res.body.rejectionReason).toBeNull();
      expect(res.body.submitterEmail).toBe(submitterEmail);
      expect(res.body).not.toHaveProperty('submittedByUserId');

      const stored = await prisma.coin.findUniqueOrThrow({ where: { id: approveId } });
      expect(stored.status).toBe('approved');
      expect(stored.name).toBe(`${names.approve} (edited)`);
      expect(stored.year).toBe(1911);
      expect(stored.country).toBe('USA');
    });

    it('makes the approved coin visible in the anonymous GET /catalog', async () => {
      const res = await http().get('/api/v1/catalog').query({ name: names.approve, limit: 100 }).expect(200);

      const ids = (res.body.items as Array<{ id: string }>).map((i) => i.id);
      expect(ids).toContain(approveId);
    });

    it('removes the approved coin from the pending admin list', async () => {
      const res = await http()
        .get('/api/v1/admin/coins?status=pending&limit=100')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect((res.body.items as Array<{ id: string }>).map((i) => i.id)).not.toContain(approveId);
    });
  });

  describe('reject (criteria #8, #12, #13)', () => {
    it('returns 200 for the admin and stores the reason', async () => {
      const res = await http()
        .patch(`/api/v1/admin/coins/${rejectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'rejected', rejectionReason: `  ${REJECTION_REASON}  ` })
        .expect(200);

      expect(res.body.status).toBe('rejected');
      expect(res.body.rejectionReason).toBe(REJECTION_REASON);
      expect(res.body).not.toHaveProperty('submittedByUserId');

      const stored = await prisma.coin.findUniqueOrThrow({ where: { id: rejectId } });
      expect(stored.status).toBe('rejected');
      expect(stored.rejectionReason).toBe(REJECTION_REASON);
    });

    it('keeps the rejected coin out of the anonymous GET /catalog', async () => {
      const res = await http().get('/api/v1/catalog').query({ name: names.reject, limit: 100 }).expect(200);

      const ids = (res.body.items as Array<{ id: string }>).map((i) => i.id);
      expect(ids).not.toContain(rejectId);
    });

    it('shows the reason to the submitter through GET /catalog?submittedByMe=true', async () => {
      const res = await http()
        .get('/api/v1/catalog')
        .query({ submittedByMe: 'true', name: names.reject, limit: 100 })
        .set('Authorization', `Bearer ${submitterToken}`)
        .expect(200);

      const items = res.body.items as Array<Record<string, unknown>>;
      const item = items.find((i) => i.id === rejectId);
      expect(item).toBeDefined();
      expect(item?.status).toBe('rejected');
      expect(item?.rejectionReason).toBe(REJECTION_REASON);
      expect(item).not.toHaveProperty('submittedByUserId');
    });

    it('does not show the reason to another user: their submittedByMe list does not contain the coin', async () => {
      const res = await http()
        .get('/api/v1/catalog')
        .query({ submittedByMe: 'true', name: names.reject, limit: 100 })
        .set('Authorization', `Bearer ${plainToken}`)
        .expect(200);

      const ids = (res.body.items as Array<{ id: string }>).map((i) => i.id);
      expect(ids).not.toContain(rejectId);
      expect(JSON.stringify(res.body)).not.toContain(REJECTION_REASON);
    });

    it('does not expose the reason on anonymous GET /catalog, even with submittedByMe=true', async () => {
      const plain = await http().get('/api/v1/catalog').query({ name: names.reject, limit: 100 }).expect(200);
      const asked = await http()
        .get('/api/v1/catalog')
        .query({ submittedByMe: 'true', name: names.reject, limit: 100 })
        .expect(200);

      expect(JSON.stringify(plain.body)).not.toContain(REJECTION_REASON);
      expect(JSON.stringify(asked.body)).not.toContain(REJECTION_REASON);
    });

    it('does not expose the reason or submittedByUserId on GET /catalog/:id', async () => {
      const res = await http().get(`/api/v1/catalog/${rejectId}`).expect(200);

      expect(res.body.id).toBe(rejectId);
      expect(res.body).not.toHaveProperty('rejectionReason');
      expect(res.body).not.toHaveProperty('submittedByUserId');
    });
  });

  describe('public reads never expose submittedByUserId (criterion #14)', () => {
    it('GET /catalog items have no submittedByUserId key', async () => {
      const res = await http().get('/api/v1/catalog').query({ name: names.approve, limit: 100 }).expect(200);

      const items = res.body.items as Array<Record<string, unknown>>;
      expect(items.length).toBeGreaterThan(0);
      for (const item of items) {
        expect(item).not.toHaveProperty('submittedByUserId');
        expect(item).not.toHaveProperty('rejectionReason');
      }
    });

    it('GET /catalog/:id has no submittedByUserId key for an approved coin', async () => {
      const res = await http().get(`/api/v1/catalog/${approveId}`).expect(200);

      expect(res.body.id).toBe(approveId);
      expect(res.body).not.toHaveProperty('submittedByUserId');
    });
  });

  describe('final decisions (criterion #10)', () => {
    it('returns 409 for PATCH on an already approved coin and changes nothing', async () => {
      await http()
        .patch(`/api/v1/admin/coins/${approveId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'rejected', rejectionReason: 'changed my mind' })
        .expect(409);

      const stored = await prisma.coin.findUniqueOrThrow({ where: { id: approveId } });
      expect(stored.status).toBe('approved');
      expect(stored.rejectionReason).toBeNull();
    });

    it('returns 409 for PATCH on an already rejected coin and changes nothing', async () => {
      await http()
        .patch(`/api/v1/admin/coins/${rejectId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' })
        .expect(409);

      const stored = await prisma.coin.findUniqueOrThrow({ where: { id: rejectId } });
      expect(stored.status).toBe('rejected');
      expect(stored.rejectionReason).toBe(REJECTION_REASON);
    });

    it('returns 404 for an unknown coin id', async () => {
      await http()
        .patch(`/api/v1/admin/coins/${UNKNOWN_COIN_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' })
        .expect(404);
    });
  });

  describe('edits and non-editable fields (criterion #9)', () => {
    it('returns 409 and leaves the coin pending when an edit collides with an existing coin natural key', async () => {
      const existing = await prisma.coin.findUniqueOrThrow({ where: { id: existingId } });

      await http()
        .patch(`/api/v1/admin/coins/${collideId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved', variety: existing.variety })
        .expect(409);

      const stored = await prisma.coin.findUniqueOrThrow({ where: { id: collideId } });
      expect(stored.status).toBe('pending');
      expect(stored.variety).not.toBe(existing.variety);
    });

    it('ignores submittedByUserId sent in the PATCH body', async () => {
      await http()
        .patch(`/api/v1/admin/coins/${ignoreId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved', submittedByUserId: plainId })
        .expect(200);

      const stored = await prisma.coin.findUniqueOrThrow({ where: { id: ignoreId } });
      expect(stored.status).toBe('approved');
      expect(stored.submittedByUserId).toBe(submitterId);
      expect(stored.submittedByUserId).not.toBe(plainId);
    });
  });

  describe('immediate effect of a demotion (criteria #3, #4)', () => {
    it('gives 403 on the same admin token once the role is changed in the DB (run last)', async () => {
      await http()
        .get('/api/v1/admin/coins?status=pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      await prisma.user.update({ where: { id: adminId }, data: { role: 'user' } });

      await http()
        .get('/api/v1/admin/coins?status=pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(403);
      await http()
        .patch(`/api/v1/admin/coins/${demoteId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' })
        .expect(403);

      expect((await prisma.coin.findUniqueOrThrow({ where: { id: demoteId } })).status).toBe('pending');
    });
  });
});
