/**
 * Tests for: POST /collection/import/preview and /confirm with grades (e2e)
 * Contract source: runs/run_20261104_064643/plan.md § Interface Contract (HTTP) and § Notes for the Tester
 * Covers criteria: #2, #4, #5, #6, #7, #8, #9, #10, #11 (from runs/run_20261104_064643/prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Needs a live DATABASE_URL, so it only runs in Verify's `api e2e` step (throwaway DB), like the other
 * *.e2e-spec.ts files. It builds its own app (own throttle budget: preview 10, confirm 5 per minute).
 * One real user is registered through the real /auth endpoints; approved coins with a unique country are
 * created through PrismaService and everything scoped to this run's stamp is deleted in afterAll.
 * Budget used: 2 previews, 5 confirms, 1 register, 1 login.
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

describe('Collection import grades (e2e)', () => {
  let app: NestExpressApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const country = `E2E ImportGrades ${stamp}`;
  const email = `e2e-import-grades-${stamp}@example.com`;
  const password = 'correct-horse-battery-staple';

  let token: string;
  let userId: string;
  let coinA: string; // 1950 D
  let coinB: string; // 1951 S
  let coinC: string; // 1952, owned with grade F before any import

  const auth = () => ({ Authorization: `Bearer ${token}` });

  const gradeOf = async (coinId: string) =>
    (await prisma.ownership.findUnique({ where: { userId_coinId: { userId, coinId } } }))?.grade ?? undefined;

  const countState = async () => ({
    ownership: await prisma.ownership.count({ where: { userId } }),
    coins: await prisma.coin.count({ where: { country } }),
  });

  beforeAll(async () => {
    app = await buildApp();
    prisma = app.get(PrismaService);

    await request(app.getHttpServer()).post('/api/v1/auth/register').send({ email, password }).expect(201);
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(200);
    token = login.body.accessToken;
    userId = (await prisma.user.findUniqueOrThrow({ where: { email } })).id;

    const base = { country, denomination: 'Cent', variety: '', status: 'approved' as const };
    coinA = (await prisma.coin.create({ data: { ...base, year: 1950, mintMark: 'D', name: 'E2E IG A' } })).id;
    coinB = (await prisma.coin.create({ data: { ...base, year: 1951, mintMark: 'S', name: 'E2E IG B' } })).id;
    coinC = (await prisma.coin.create({ data: { ...base, year: 1952, mintMark: '', name: 'E2E IG C' } })).id;

    await prisma.ownership.create({ data: { userId, coinId: coinC, grade: 'F' } });
  });

  afterAll(async () => {
    await prisma.ownership.deleteMany({ where: { userId } });
    await prisma.coin.deleteMany({ where: { country } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  const gradedCsv = () =>
    Buffer.from(
      'Year,Country,Denomination,Mint Mark,Grade\n' +
        `1950,${country},Cent,D,mbc\n` +
        `1951,${country},Cent,S,shiny\n` +
        `1952,${country},Cent,,  \n`,
      'utf8',
    );

  describe('preview', () => {
    it('suggests the Grade column, normalises grades, warns on unknown values and writes nothing', async () => {
      const before = await countState();

      const res = await request(app.getHttpServer())
        .post(PREVIEW)
        .set(auth())
        .attach('file', gradedCsv(), { filename: 'g.csv', contentType: 'text/csv' })
        .expect(200);

      expect(res.body.mapping).toEqual({ year: 0, country: 1, denomination: 2, mintMark: 3, grade: 4 });
      const [rowA, rowB, rowC] = res.body.rows;
      expect(rowA).toMatchObject({ line: 2, status: 'matched', grade: 'VF' });
      expect(rowB).toMatchObject({ line: 3, status: 'matched', grade: null });
      expect(rowC).toMatchObject({ line: 4, status: 'matched', alreadyOwned: true, grade: null });
      expect(res.body.warnings).toEqual([{ line: 3, code: 'grade_not_recognised', value: 'shiny' }]);

      expect(await countState()).toEqual(before);
      expect(await gradeOf(coinC)).toBe('F');
    });

    it('returns grade null and no warnings when the Grade column is explicitly unmapped', async () => {
      const mapping = { year: 0, country: 1, denomination: 2, mintMark: 3, grade: null };
      const res = await request(app.getHttpServer())
        .post(PREVIEW)
        .set(auth())
        .field('mapping', JSON.stringify(mapping))
        .attach('file', gradedCsv(), { filename: 'g.csv', contentType: 'text/csv' })
        .expect(200);

      expect(res.body.mapping).toEqual({ year: 0, country: 1, denomination: 2, mintMark: 3 });
      expect(res.body.rows.map((r: { grade: unknown }) => r.grade)).toEqual([null, null, null]);
      expect(res.body.warnings).toEqual([]);
    });
  });

  describe('confirm', () => {
    it('creates ownership with the grade for new coins and leaves an owned coin without a grade entry untouched', async () => {
      const res = await request(app.getHttpServer())
        .post(CONFIRM)
        .set(auth())
        .send({
          coinIds: [coinA, coinB, coinC],
          grades: [
            { coinId: coinA, grade: 'VF' },
            { coinId: coinB, grade: 'UNC' },
          ],
        })
        .expect(200);

      expect(res.body).toEqual({ requested: 3, created: 2, alreadyOwned: 1 });
      expect(await gradeOf(coinA)).toBe('VF');
      expect(await gradeOf(coinB)).toBe('UNC');
      // coinC was sent without a grade (blank/unknown in the file): its grade is not wiped
      expect(await gradeOf(coinC)).toBe('F');
    });

    it('overwrites the grade of an owned coin with a recognised grade and never touches the others', async () => {
      const res = await request(app.getHttpServer())
        .post(CONFIRM)
        .set(auth())
        .send({
          coinIds: [coinA, coinB, coinC],
          grades: [{ coinId: coinC, grade: 'AU' }],
        })
        .expect(200);

      expect(res.body).toEqual({ requested: 3, created: 0, alreadyOwned: 3 });
      expect(await gradeOf(coinC)).toBe('AU');
      expect(await gradeOf(coinA)).toBe('VF');
      expect(await gradeOf(coinB)).toBe('UNC');
    });

    it('rejects a grade for a coin that is not in coinIds with 400 IMPORT_INVALID_GRADES and changes nothing', async () => {
      const res = await request(app.getHttpServer())
        .post(CONFIRM)
        .set(auth())
        .send({ coinIds: [coinA], grades: [{ coinId: coinB, grade: 'G' }] })
        .expect(400);

      expect(res.body.message).toBe('IMPORT_INVALID_GRADES');
      expect(await gradeOf(coinB)).toBe('UNC');
    });

    it('rejects a grade outside COIN_GRADES with 400 and changes nothing', async () => {
      await request(app.getHttpServer())
        .post(CONFIRM)
        .set(auth())
        .send({ coinIds: [coinA], grades: [{ coinId: coinA, grade: 'MBC' }] })
        .expect(400);

      expect(await gradeOf(coinA)).toBe('VF');
    });

    it('without grades behaves as before: creates nothing for owned coins and keeps every grade', async () => {
      const before = await countState();
      const res = await request(app.getHttpServer())
        .post(CONFIRM)
        .set(auth())
        .send({ coinIds: [coinA, coinB, coinC] })
        .expect(200);

      expect(res.body).toEqual({ requested: 3, created: 0, alreadyOwned: 3 });
      expect(await countState()).toEqual(before);
      expect(await gradeOf(coinA)).toBe('VF');
      expect(await gradeOf(coinB)).toBe('UNC');
      expect(await gradeOf(coinC)).toBe('AU');
    });
  });
});
