/**
 * Tests for: GET /catalog?submittedByMe=true (e2e)
 * Contract source: runs/run_20260731_132040/plan.md § Interface Contract
 *                   (Guard: OptionalJwtAuthGuard, Controller: CatalogController.findAll,
 *                    Service: CatalogService.findAll)
 * Covers criteria: #1, #2, #3, #4 (from run_20260731_132040's prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * This is the one behavior a mocked-Prisma unit test structurally can't verify: a real Nest
 * app + real Passport JWT verification actually distinguishing an anonymous request from an
 * authenticated one on the same @Public() route, and a real Prisma query actually scoping rows
 * to the caller's own submittedByUserId. Two real users are registered via the real
 * /auth/register + /auth/login endpoints (same pattern as auth.e2e-spec.ts); their coins are
 * created directly via PrismaService (not POST /catalog) so pending/approved/rejected fixtures
 * can all exist without a review/approve endpoint (none exists yet, out of scope per plan.md).
 * All throwaway users/coins are deleted in afterAll — same cleanup discipline as every other
 * e2e spec in this repo.
 *
 * NOTE (plan.md Risks): this file is not run by the orchestration pipeline's automated
 * sandbox — `pnpm --filter api test:e2e` needs a live DATABASE_URL the disposable sandbox
 * worktree doesn't have (repo-digest.md's Test command intentionally runs `test` only, not
 * `test:e2e`). It is written here per backlog task 1.7 for a human to run against the real
 * dev DB as part of task 1.8's manual pass.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('GET /catalog?submittedByMe=true (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const emailA = `e2e-my-submissions-a-${Date.now()}@example.com`;
  const emailB = `e2e-my-submissions-b-${Date.now()}@example.com`;
  const password = 'correct-horse-battery-staple';

  let tokenA: string;
  let tokenB: string;
  let userAId: string;
  let userBId: string;
  const createdCoinIds: string[] = [];

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: emailA, password }).expect(201);
    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email: emailB, password }).expect(201);

    const loginA = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailA, password })
      .expect(200);
    tokenA = loginA.body.accessToken;

    const loginB = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: emailB, password })
      .expect(200);
    tokenB = loginB.body.accessToken;

    const userA = await prisma.user.findUniqueOrThrow({ where: { email: emailA } });
    const userB = await prisma.user.findUniqueOrThrow({ where: { email: emailB } });
    userAId = userA.id;
    userBId = userB.id;

    const pendingA = await prisma.coin.create({
      data: {
        country: 'USA',
        denomination: '1 Cent',
        year: 1943,
        mintMark: 'D',
        variety: 'e2e-pending-a',
        name: 'E2E Pending Coin A',
        status: 'pending',
        submittedByUserId: userAId,
        submittedAt: new Date(),
      },
    });
    const approvedA = await prisma.coin.create({
      data: {
        country: 'USA',
        denomination: '1 Cent',
        year: 1944,
        mintMark: 'D',
        variety: 'e2e-approved-a',
        name: 'E2E Approved Coin A',
        status: 'approved',
        submittedByUserId: userAId,
        submittedAt: new Date(),
      },
    });
    const rejectedA = await prisma.coin.create({
      data: {
        country: 'USA',
        denomination: '1 Cent',
        year: 1945,
        mintMark: 'D',
        variety: 'e2e-rejected-a',
        name: 'E2E Rejected Coin A',
        status: 'rejected',
        submittedByUserId: userAId,
        submittedAt: new Date(),
      },
    });
    const pendingB = await prisma.coin.create({
      data: {
        country: 'USA',
        denomination: '1 Cent',
        year: 1946,
        mintMark: 'D',
        variety: 'e2e-pending-b',
        name: 'E2E Pending Coin B',
        status: 'pending',
        submittedByUserId: userBId,
        submittedAt: new Date(),
      },
    });

    createdCoinIds.push(pendingA.id, approvedA.id, rejectedA.id, pendingB.id);
  });

  afterAll(async () => {
    await prisma.coin.deleteMany({ where: { id: { in: createdCoinIds } } });
    await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
    await app.close();
  });

  it('an anonymous GET /catalog?submittedByMe=true behaves like a normal anonymous call — 200, approved-only, no 401 (criterion #2)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/catalog')
      .query({ submittedByMe: 'true', name: 'E2E' })
      .expect(200);

    const returned = res.body.items as Array<{ name: string; status: string }>;
    const returnedNames = returned.map((item) => item.name);

    expect(returned.every((item) => item.status === 'approved')).toBe(true);
    expect(returnedNames).toContain('E2E Approved Coin A');
    expect(returnedNames).not.toContain('E2E Pending Coin A');
    expect(returnedNames).not.toContain('E2E Rejected Coin A');
    expect(returnedNames).not.toContain('E2E Pending Coin B');
  });

  it('user A\'s authenticated GET /catalog?submittedByMe=true returns their own pending/approved/rejected submissions (criterion #1)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/catalog')
      .query({ submittedByMe: 'true', name: 'E2E' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const returned = res.body.items as Array<{ id: string; name: string; status: string }>;
    const returnedNames = returned.map((item) => item.name);

    expect(returnedNames).toEqual(
      expect.arrayContaining(['E2E Pending Coin A', 'E2E Approved Coin A', 'E2E Rejected Coin A']),
    );
    expect(returnedNames).not.toContain('E2E Pending Coin B');
  });

  it('user B\'s authenticated GET /catalog?submittedByMe=true does not include user A\'s coins (criterion #1 contrast)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/catalog')
      .query({ submittedByMe: 'true', name: 'E2E' })
      .set('Authorization', `Bearer ${tokenB}`)
      .expect(200);

    const returnedNames = (res.body.items as Array<{ name: string }>).map((item) => item.name);

    expect(returnedNames).toContain('E2E Pending Coin B');
    expect(returnedNames).not.toContain('E2E Pending Coin A');
    expect(returnedNames).not.toContain('E2E Approved Coin A');
    expect(returnedNames).not.toContain('E2E Rejected Coin A');
  });

  it('an authenticated call without submittedByMe is unaffected — still approved-only, same as before this feature (criterion #3)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/catalog')
      .query({ name: 'E2E' })
      .set('Authorization', `Bearer ${tokenA}`)
      .expect(200);

    const returnedNames = (res.body.items as Array<{ name: string }>).map((item) => item.name);

    expect(returnedNames).toContain('E2E Approved Coin A');
    expect(returnedNames).not.toContain('E2E Pending Coin A');
    expect(returnedNames).not.toContain('E2E Rejected Coin A');
  });
});
