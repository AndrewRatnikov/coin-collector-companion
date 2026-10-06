/**
 * Tests for: POST /collection/import/preview and POST /collection/import/confirm (e2e)
 * Contract source: runs/run_20261005_212015/plan.md § Interface Contract (API endpoints) and § Test notes (E2E)
 * Covers criteria: #1, #2, #3, #4, #5, #6, #9, #10, #11, #22 (from runs/run_20261005_212015/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Needs a live DATABASE_URL, so it only runs in Verify's `api e2e` step (throwaway DB), like the other
 * *.e2e-spec.ts files. One real user is registered through the real /auth endpoints; approved and pending
 * coins with a unique country are created directly through PrismaService and everything is deleted in
 * afterAll. Throttle budget per app instance: preview 7 calls (limit 10), confirm 4 calls (limit 5),
 * register 1 and login 1 (limit 5 each). The 429 checks use their own app instance.
 */

import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import { PrismaService } from '../src/prisma/prisma.service';

const PREVIEW = '/api/v1/collection/import/preview';
const CONFIRM = '/api/v1/collection/import/confirm';

async function buildApp(): Promise<NestExpressApplication> {
  const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleFixture.createNestApplication<NestExpressApplication>();
  configureApp(app);
  await app.init();
  return app;
}

function csvBuffer(text: string): Buffer {
  return Buffer.from(text, 'utf8');
}

describe('Collection import (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const country = `E2E Import ${stamp}`;
  const email = `e2e-collection-import-${stamp}@example.com`;
  const password = 'correct-horse-battery-staple';

  let token: string;
  let userId: string;
  let coinA: string; // 1950 D, approved
  let coinB: string; // 1951 S, approved
  let coinC: string; // 1952 (no mint mark), approved, already owned before the import
  let pendingCoin: string; // 1953, pending
  let preexistingOwnedAt: Date;

  const auth = () => ({ Authorization: `Bearer ${token}` });

  const countState = async () => ({
    ownership: await prisma.ownership.count({ where: { userId } }),
    coins: await prisma.coin.count({ where: { country } }),
    userSets: await prisma.userSet.count({ where: { userId } }),
    userSetCoins: await prisma.userSetCoin.count({ where: { userSet: { userId } } }),
  });

  beforeAll(async () => {
    app = await buildApp();
    prisma = app.get(PrismaService);

    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email, password }).expect(201);
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(200);
    token = login.body.accessToken;
    userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

    const base = { country, denomination: 'Cent', variety: '' };
    coinA = (
      await prisma.coin.create({ data: { ...base, year: 1950, mintMark: 'D', name: 'E2E Import A', status: 'approved' } })
    ).id;
    coinB = (
      await prisma.coin.create({ data: { ...base, year: 1951, mintMark: 'S', name: 'E2E Import B', status: 'approved' } })
    ).id;
    coinC = (
      await prisma.coin.create({ data: { ...base, year: 1952, mintMark: '', name: 'E2E Import C', status: 'approved' } })
    ).id;
    pendingCoin = (
      await prisma.coin.create({
        data: {
          ...base,
          year: 1953,
          mintMark: '',
          name: 'E2E Import Pending',
          status: 'pending',
          submittedByUserId: userId,
          submittedAt: new Date(),
        },
      })
    ).id;

    const owned = await prisma.ownership.create({ data: { userId, coinId: coinC } });
    preexistingOwnedAt = owned.ownedAt;
  });

  afterAll(async () => {
    await prisma.ownership.deleteMany({ where: { userId } });
    await prisma.coin.deleteMany({ where: { country } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  const importCsv = () =>
    csvBuffer(
      'Year,Country,Denomination,Mint Mark\n' +
        `1950,${country},Cent,D\n` +
        `1951,${country},1 cent,S\n` +
        `1952,${country},Cent,\n` +
        `1953,${country},Cent,\n` +
        `1999,${country},Cent,\n`,
    );

  describe('authentication (criterion #1)', () => {
    it('POST /preview without a token returns 401', async () => {
      await request(app.getHttpServer())
        .post(PREVIEW)
        .attach('file', importCsv(), { filename: 'c.csv', contentType: 'text/csv' })
        .expect(401);
    });

    it('POST /confirm without a token returns 401 and writes nothing', async () => {
      const before = await countState();
      await request(app.getHttpServer()).post(CONFIRM).send({ coinIds: [coinA] }).expect(401);
      expect(await countState()).toEqual(before);
    });
  });

  describe('preview (criteria #2, #22)', () => {
    it('matches rows, flags the owned coin, ignores the pending coin and writes nothing', async () => {
      const before = await countState();

      const res = await request(app.getHttpServer())
        .post(PREVIEW)
        .set(auth())
        .attach('file', importCsv(), { filename: 'c.csv', contentType: 'text/csv' })
        .expect(200);

      expect(res.body.delimiter).toBe(',');
      expect(res.body.headers).toEqual(['Year', 'Country', 'Denomination', 'Mint Mark']);
      expect(res.body.mapping).toEqual({ year: 0, country: 1, denomination: 2, mintMark: 3 });
      expect(res.body.rows).toHaveLength(5);

      const [rowA, rowB, rowC, rowPending, rowUnknown] = res.body.rows;
      expect(rowA).toMatchObject({ line: 2, status: 'matched', alreadyOwned: false });
      expect(rowA.coin.id).toBe(coinA);
      expect(rowB).toMatchObject({ line: 3, status: 'matched', alreadyOwned: false });
      expect(rowB.coin.id).toBe(coinB);
      expect(rowC).toMatchObject({ line: 4, status: 'matched', alreadyOwned: true });
      expect(rowC.coin.id).toBe(coinC);
      expect(rowPending).toMatchObject({ line: 5, status: 'unmatched', reason: 'no_such_coin' });
      expect(rowUnknown).toMatchObject({ line: 6, status: 'unmatched', reason: 'no_such_coin' });
      expect(res.body.summary).toMatchObject({
        total: 5,
        matched: 3,
        alreadyOwned: 1,
        unmatched: 2,
        toImport: 2,
      });

      expect(await countState()).toEqual(before);
    });

    it('rejects a request without a file with 400 IMPORT_FILE_REQUIRED', async () => {
      const res = await request(app.getHttpServer()).post(PREVIEW).set(auth()).field('mapping', '{}').expect(400);
      expect(res.body.message).toBe('IMPORT_FILE_REQUIRED');
    });

    it('rejects an empty file with 400', async () => {
      const res = await request(app.getHttpServer())
        .post(PREVIEW)
        .set(auth())
        .attach('file', Buffer.alloc(0), { filename: 'empty.csv', contentType: 'text/csv' });
      expect(res.status).toBe(400);
    });

    it('rejects a file over 1 MB with 413', async () => {
      const big = Buffer.concat([csvBuffer('Year,Country,Denomination\n'), Buffer.alloc(1_048_576 + 1024, 'a')]);
      const res = await request(app.getHttpServer())
        .post(PREVIEW)
        .set(auth())
        .attach('file', big, { filename: 'big.csv', contentType: 'text/csv' });
      expect(res.status).toBe(413);
    });

    it('rejects 2,001 data rows with 400 IMPORT_TOO_MANY_ROWS', async () => {
      const rows = Array.from({ length: 2001 }, () => `1950,${country},Cent,D`).join('\n');
      const res = await request(app.getHttpServer())
        .post(PREVIEW)
        .set(auth())
        .attach('file', csvBuffer(`Year,Country,Denomination,Mint Mark\n${rows}\n`), {
          filename: 'many.csv',
          contentType: 'text/csv',
        })
        .expect(400);
      expect(res.body.message).toBe('IMPORT_TOO_MANY_ROWS');
    });
  });

  describe('confirm (criteria #3, #4, #5, #6)', () => {
    it('creates Ownership for new coins only, leaving Coin, UserSet, UserSetCoin and the existing ownership untouched', async () => {
      const before = await countState();

      const res = await request(app.getHttpServer())
        .post(CONFIRM)
        .set(auth())
        .send({ coinIds: [coinA, coinB, coinC, coinA] })
        .expect(200);

      expect(res.body).toEqual({ requested: 3, created: 2, alreadyOwned: 1 });

      const after = await countState();
      expect(after.ownership).toBe(before.ownership + 2);
      expect(after.coins).toBe(before.coins);
      expect(after.userSets).toBe(before.userSets);
      expect(after.userSetCoins).toBe(before.userSetCoins);

      const owned = await prisma.ownership.findMany({ where: { userId } });
      expect(owned.map((o) => o.coinId).sort()).toEqual([coinA, coinB, coinC].sort());
      const preexisting = owned.find((o) => o.coinId === coinC);
      expect(preexisting?.ownedAt.getTime()).toBe(preexistingOwnedAt.getTime());
    });

    it('re-confirming the same ids creates nothing and reports everything as already owned', async () => {
      const before = await countState();
      const res = await request(app.getHttpServer())
        .post(CONFIRM)
        .set(auth())
        .send({ coinIds: [coinA, coinB, coinC] })
        .expect(200);
      expect(res.body).toEqual({ requested: 3, created: 0, alreadyOwned: 3 });
      expect(await countState()).toEqual(before);
    });

    it('rejects a pending coin id with 400 IMPORT_UNKNOWN_COIN and writes nothing, even alongside valid ids', async () => {
      const before = await countState();
      const res = await request(app.getHttpServer())
        .post(CONFIRM)
        .set(auth())
        .send({ coinIds: [coinA, pendingCoin] })
        .expect(400);
      expect(res.body.message).toBe('IMPORT_UNKNOWN_COIN');
      expect(await countState()).toEqual(before);
    });
  });

  describe('re-preview after confirm (criterion #5)', () => {
    it('reports every matched row as already owned and nothing to import, honouring an explicit mapping', async () => {
      const mapping = { year: 0, country: 1, denomination: 2, mintMark: 3 };
      const res = await request(app.getHttpServer())
        .post(PREVIEW)
        .set(auth())
        .field('mapping', JSON.stringify(mapping))
        .attach('file', importCsv(), { filename: 'c.csv', contentType: 'text/csv' })
        .expect(200);

      expect(res.body.mapping).toEqual(mapping);
      const matched = res.body.rows.filter((r: { status: string }) => r.status === 'matched');
      expect(matched).toHaveLength(3);
      expect(matched.every((r: { alreadyOwned: boolean }) => r.alreadyOwned)).toBe(true);
      expect(res.body.summary).toMatchObject({ matched: 3, alreadyOwned: 3, toImport: 0 });
    });
  });
});

describe('Collection import rate limits (e2e)', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    app = await buildApp();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /preview: the 11th request within the window returns 429', async () => {
    for (let i = 0; i < 10; i++) {
      const res = await request(app.getHttpServer()).post(PREVIEW);
      expect(res.status).toBe(401);
    }
    const res = await request(app.getHttpServer()).post(PREVIEW);
    expect(res.status).toBe(429);
  });

  it('POST /confirm: the 6th request within the window returns 429', async () => {
    for (let i = 0; i < 5; i++) {
      const res = await request(app.getHttpServer()).post(CONFIRM).send({ coinIds: [] });
      expect(res.status).toBe(401);
    }
    const res = await request(app.getHttpServer()).post(CONFIRM).send({ coinIds: [] });
    expect(res.status).toBe(429);
  });
});
