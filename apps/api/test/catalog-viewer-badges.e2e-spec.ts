/**
 * Tests for: GET /catalog viewer fields owned / inSetsCount (e2e)
 * Contract source: runs/run_20261019_221037/plan.md § Interface Contract → E2E: GET /catalog viewer fields
 * Covers criteria: #1, #2, #3, #5 (from prd.md)
 *
 * CONTRACT_GAP: none.
 *
 * Real Nest app + real Prisma against a throwaway Postgres. A mocked unit test cannot prove the
 * `userSet: { userId }` relation filter, so this spec does. Fixtures: four approved coins sharing a
 * unique `variety` (so a `name`/`variety`-free filter is isolated via the unique country), one
 * Ownership for user A, two of A's sets and one of B's sets holding the same coin, and a
 * CanonicalSet holding it. All fixtures are removed in afterAll, children first.
 *
 * NOTE: not run by the sandbox Test command (needs a live DATABASE_URL); run it against Verify's
 * throwaway Postgres.
 */

import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

interface ViewerItem {
  id: string;
  owned?: boolean;
  inSetsCount?: number;
}

describe('GET /catalog viewer fields (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const stamp = Date.now();
  const emailA = `e2e-viewer-badges-a-${stamp}@example.com`;
  const emailB = `e2e-viewer-badges-b-${stamp}@example.com`;
  const password = 'correct-horse-battery-staple';
  // A unique country isolates the fixture coins from whatever else is in the DB.
  const country = `E2E-Viewer-${stamp}`;

  let tokenA: string;
  let userAId: string;
  let userBId: string;
  let ownedCoinId: string;
  let sharedCoinId: string;
  let plainCoinId: string;
  let ownedAndSharedCoinId: string;
  const coinIds: string[] = [];
  const userSetIds: string[] = [];
  let canonicalSetId: string;

  async function createCoin(year: number, variety: string): Promise<string> {
    const coin = await prisma.coin.create({
      data: {
        country,
        denomination: '1 Cent',
        year,
        mintMark: '',
        variety,
        name: `E2E Viewer Coin ${variety}`,
        status: 'approved',
      },
    });
    coinIds.push(coin.id);
    return coin.id;
  }

  // Not async on purpose: returns the supertest Test so callers can chain .expect().
  function getCatalog(query: Record<string, string>, token?: string) {
    const req = request(app.getHttpServer()).get('/api/v1/catalog').query({ country, limit: '100', ...query });
    return token === undefined ? req : req.set('Authorization', token);
  }

  function byId(items: ViewerItem[], id: string): ViewerItem {
    const found = items.find((item) => item.id === id);
    if (!found) throw new Error(`coin ${id} missing from the response`);
    return found;
  }

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

    userAId = (await prisma.user.findUniqueOrThrow({ where: { email: emailA } })).id;
    userBId = (await prisma.user.findUniqueOrThrow({ where: { email: emailB } })).id;

    ownedCoinId = await createCoin(1901, `e2e-viewer-owned-${stamp}`);
    sharedCoinId = await createCoin(1902, `e2e-viewer-shared-${stamp}`);
    plainCoinId = await createCoin(1903, `e2e-viewer-plain-${stamp}`);
    ownedAndSharedCoinId = await createCoin(1904, `e2e-viewer-both-${stamp}`);

    await prisma.ownership.createMany({
      data: [
        { userId: userAId, coinId: ownedCoinId },
        { userId: userAId, coinId: ownedAndSharedCoinId },
      ],
    });

    const setA1 = await prisma.userSet.create({ data: { userId: userAId, name: `E2E viewer set A1 ${stamp}` } });
    const setA2 = await prisma.userSet.create({ data: { userId: userAId, name: `E2E viewer set A2 ${stamp}` } });
    const setB = await prisma.userSet.create({ data: { userId: userBId, name: `E2E viewer set B ${stamp}` } });
    userSetIds.push(setA1.id, setA2.id, setB.id);

    await prisma.userSetCoin.createMany({
      data: [
        { userSetId: setA1.id, coinId: sharedCoinId, position: 0 },
        { userSetId: setA2.id, coinId: sharedCoinId, position: 0 },
        { userSetId: setB.id, coinId: sharedCoinId, position: 0 },
        { userSetId: setA1.id, coinId: ownedAndSharedCoinId, position: 1 },
      ],
    });

    const canonical = await prisma.canonicalSet.create({
      data: { name: `E2E viewer canonical ${stamp}`, source: 'admin', templateVersion: 'e2e' },
    });
    canonicalSetId = canonical.id;
    await prisma.canonicalSetCoin.create({
      data: { canonicalSetId, coinId: sharedCoinId, position: 0 },
    });
  });

  afterAll(async () => {
    await prisma.userSetCoin.deleteMany({ where: { coinId: { in: coinIds } } });
    await prisma.userSet.deleteMany({ where: { id: { in: userSetIds } } });
    await prisma.canonicalSetCoin.deleteMany({ where: { coinId: { in: coinIds } } });
    await prisma.canonicalSet.deleteMany({ where: { id: canonicalSetId } });
    await prisma.ownership.deleteMany({ where: { coinId: { in: coinIds } } });
    await prisma.coin.deleteMany({ where: { id: { in: coinIds } } });
    await prisma.refreshToken.deleteMany({ where: { userId: { in: [userAId, userBId] } } });
    await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
    await app.close();
  });

  it('a valid JWT gets owned true/false correctly on every item (criterion #1)', async () => {
    const res = await getCatalog({}, `Bearer ${tokenA}`).expect(200);
    const items = res.body.items as ViewerItem[];

    expect(items).toHaveLength(4);
    expect(byId(items, ownedCoinId).owned).toBe(true);
    expect(byId(items, ownedAndSharedCoinId).owned).toBe(true);
    expect(byId(items, sharedCoinId).owned).toBe(false);
    expect(byId(items, plainCoinId).owned).toBe(false);
  });

  it('inSetsCount counts only the caller\'s own sets, once each: 2, not 3 and not 4 (criteria #1, #3)', async () => {
    const res = await getCatalog({}, `Bearer ${tokenA}`).expect(200);
    const items = res.body.items as ViewerItem[];

    // shared coin: A's two sets count; B's set and the canonical set do not.
    expect(byId(items, sharedCoinId).inSetsCount).toBe(2);
    expect(byId(items, ownedAndSharedCoinId).inSetsCount).toBe(1);
    expect(byId(items, ownedCoinId).inSetsCount).toBe(0);
    expect(byId(items, plainCoinId).inSetsCount).toBe(0);
  });

  it('a request with no token gets 200 and items without owned / inSetsCount (criterion #2)', async () => {
    const res = await getCatalog({}).expect(200);
    const items = res.body.items as ViewerItem[];

    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item).not.toHaveProperty('owned');
      expect(item).not.toHaveProperty('inSetsCount');
    }
  });

  it('an invalid token gets 200 and items without owned / inSetsCount (criterion #2)', async () => {
    const res = await getCatalog({}, 'Bearer not-a-jwt').expect(200);
    const items = res.body.items as ViewerItem[];

    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item).not.toHaveProperty('owned');
      expect(item).not.toHaveProperty('inSetsCount');
    }
  });

  it('hideOwned=true: total is the anonymous total minus the owned coins, and every item is owned:false (criterion #5)', async () => {
    const anonymous = await getCatalog({}).expect(200);
    const hidden = await getCatalog({ hideOwned: 'true' }, `Bearer ${tokenA}`).expect(200);
    const items = hidden.body.items as ViewerItem[];

    expect(anonymous.body.total).toBe(4);
    expect(hidden.body.total).toBe(anonymous.body.total - 2);
    expect(items.map((item) => item.id).sort()).toEqual([sharedCoinId, plainCoinId].sort());
    expect(items.every((item) => item.owned === false)).toBe(true);
    // inSetsCount can still be >= 1 while hideOwned is on.
    expect(byId(items, sharedCoinId).inSetsCount).toBe(2);
  });

  it('pagination keeps total and enriches only the requested page (criterion #5)', async () => {
    const res = await getCatalog({ limit: '2', page: '2', sort: 'year_asc' }, `Bearer ${tokenA}`).expect(200);
    const items = res.body.items as ViewerItem[];

    expect(res.body.total).toBe(4);
    expect(items.map((item) => item.id)).toEqual([plainCoinId, ownedAndSharedCoinId]);
    expect(byId(items, ownedAndSharedCoinId)).toMatchObject({ owned: true, inSetsCount: 1 });
    expect(byId(items, plainCoinId)).toMatchObject({ owned: false, inSetsCount: 0 });
  });
});
