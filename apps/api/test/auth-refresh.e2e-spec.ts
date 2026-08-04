/**
 * Tests for: POST /auth/refresh, POST /auth/logout (rotate-on-use refresh token cookie flow)
 * Contract source: runs/run_20260802_221803/plan.md § Interface Contract →
 *                   Module: apps/api/src/auth/auth.controller.ts (MODIFY),
 *                   Module: apps/api/src/auth/token.service.ts (CREATE)
 * Covers criteria: #4, #5, #6, #9 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Hits a real Postgres DB via the app's real PrismaService/AppModule — same convention as
 * apps/api/test/auth.e2e-spec.ts. NOT run by this pipeline's automated sandbox (no reachable
 * Postgres there — see repo-digest.md's Test command note); runs in CI
 * (.github/workflows/ci.yml provisions a real postgres:16-alpine service) and in the manual
 * live pass instead. Cookies are threaded between requests by reading the raw `set-cookie`
 * response header and replaying it via `.set('Cookie', ...)` on the next request — the same
 * plain `request(app.getHttpServer())` style the existing auth.e2e-spec.ts already uses,
 * rather than introducing a `supertest` agent convention not otherwise used in this repo.
 *
 * cookieParser() is applied manually on the test app the same way setGlobalPrefix/
 * useGlobalPipes already are in auth.e2e-spec.ts — main.ts's imperative bootstrap() calls
 * are not part of AppModule's declarative metadata, so Test.createTestingModule({imports:
 * [AppModule]}) does not pick them up automatically.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

function extractRefreshCookie(res: request.Response): string {
  const setCookie = (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
  const raw = setCookie.find((c) => c.startsWith('refreshToken='));
  if (!raw) {
    throw new Error('No refreshToken cookie found in Set-Cookie header');
  }
  return raw.split(';')[0]; // "refreshToken=<value>"
}

describe('Auth refresh/logout (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `e2e-auth-refresh-${Date.now()}@example.com`;
  const password = 'correct-horse-battery-staple';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.use(cookieParser());
    await app.init();

    prisma = app.get(PrismaService);

    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email, password }).expect(201);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('login sets a refreshToken cookie', async () => {
    const res = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(200);

    expect(res.body.accessToken).toEqual(expect.any(String));
    const cookie = extractRefreshCookie(res);
    expect(cookie).toMatch(/^refreshToken=/);
  });

  it('refreshes: returns a new access token and rotates the cookie; the original cookie then fails, and so does a follow-up refresh with the new one (whole family revoked)', async () => {
    const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(200);
    const originalCookie = extractRefreshCookie(loginRes);

    const refreshRes = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalCookie)
      .expect(200);

    expect(refreshRes.body.accessToken).toEqual(expect.any(String));
    const rotatedCookie = extractRefreshCookie(refreshRes);
    expect(rotatedCookie).not.toBe(originalCookie);

    // Replaying the original (now-rotated-out) cookie is rejected...
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Cookie', originalCookie).expect(401);

    // ...and revokes the whole family, so even the freshly-rotated cookie now fails too.
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Cookie', rotatedCookie).expect(401);
  });

  it('rejects a refresh with no cookie at all', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/refresh').expect(401);
  });

  it('logout then refresh with the same cookie fails', async () => {
    const loginRes = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(200);
    const cookie = extractRefreshCookie(loginRes);

    await request(app.getHttpServer()).post('/api/v1/auth/logout').set('Cookie', cookie).expect(204);

    await request(app.getHttpServer()).post('/api/v1/auth/refresh').set('Cookie', cookie).expect(401);
  });

  it('logout is idempotent — a second logout with no cookie does not error', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/logout').expect(204);
  });
});
