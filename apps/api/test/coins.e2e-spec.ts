import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Exercises backlog 4.3/4.4 end to end against the real seeded Lincoln Wheat Cents
// template (prisma db seed) — auto-suggest's null-safe mint matching and the
// key-date VDB/plain ambiguity only mean something against real slot rows.
describe('Coins auto-suggest + linking (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `e2e-coins-${Date.now()}@example.com`;
  const password = 'correct-horse-battery-staple';
  let userId: string;
  let accessToken: string;
  let lincolnSetId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const lincolnSet = await prisma.collectionSet.findFirst({
      where: { isTemplate: true, name: 'Lincoln Wheat Cents (1909-1958)' },
    });
    if (!lincolnSet) {
      throw new Error(
        'Lincoln Wheat Cents template not found — run `pnpm --filter api exec prisma db seed` before this test',
      );
    }
    lincolnSetId = lincolnSet.id;

    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password });
    userId = registerRes.body.id;

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    accessToken = loginRes.body.accessToken;

    // Auto-suggest only surfaces slots from sets the user has actually activated (SD D3).
    await request(app.getHttpServer())
      .post(`/api/v1/sets/${lincolnSetId}/activate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
  }, 20_000);

  afterAll(async () => {
    await prisma.coinItem.deleteMany({ where: { userId } });
    await prisma.userSet.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  const auth = () => `Bearer ${accessToken}`;

  it('matches a no-mark Philadelphia coin against its null-mint slot', async () => {
    // 1910 has exactly one Philadelphia slot (mintMark: null, no VDB/label variant) —
    // sending "P" must normalize to null and match it via null-safe equality, not miss it.
    const res = await request(app.getHttpServer())
      .post('/api/v1/coins')
      .set('Authorization', auth())
      .send({ denomination: 'Cent', year: 1910, mintMark: 'P', country: 'US' })
      .expect(201);

    expect(res.body.coin.mintMark).toBeNull();
    expect(res.body.suggestions).toHaveLength(1);
    expect(res.body.suggestions[0]).toMatchObject({
      slotLabel: '1910',
      isKeyDate: false,
      currentlyLinkedCoinId: null,
    });
  });

  it('returns both the plain and VDB candidates for a 1909-S coin', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/coins')
      .set('Authorization', auth())
      .send({ denomination: 'Cent', year: 1909, mintMark: 'S', country: 'US' })
      .expect(201);

    expect(res.body.suggestions).toHaveLength(2);
    const labels = res.body.suggestions.map((s: { slotLabel: string }) => s.slotLabel);
    expect(labels).toEqual(expect.arrayContaining(['VDB', '1909-S']));
    expect(res.body.suggestions.every((s: { isKeyDate: boolean }) => s.isKeyDate)).toBe(true);
  });

  it('replaces the link atomically when a second coin claims the same slot', async () => {
    const slot = await prisma.setSlot.findFirstOrThrow({
      where: { setId: lincolnSetId, year: 1910, mintMark: null },
    });

    const firstCoin = (
      await request(app.getHttpServer())
        .post('/api/v1/coins')
        .set('Authorization', auth())
        .send({ denomination: 'Cent', year: 1910, mintMark: 'P', country: 'US' })
        .expect(201)
    ).body.coin;

    const secondCoin = (
      await request(app.getHttpServer())
        .post('/api/v1/coins')
        .set('Authorization', auth())
        .send({ denomination: 'Cent', year: 1910, mintMark: 'P', country: 'US' })
        .expect(201)
    ).body.coin;

    const firstLink = await request(app.getHttpServer())
      .post(`/api/v1/coins/${firstCoin.id}/link`)
      .set('Authorization', auth())
      .send({ slotId: slot.id })
      .expect(201);
    expect(firstLink.body.replacedCoinId).toBeNull();
    expect(firstLink.body.coin.slotId).toBe(slot.id);

    const secondLink = await request(app.getHttpServer())
      .post(`/api/v1/coins/${secondCoin.id}/link`)
      .set('Authorization', auth())
      .send({ slotId: slot.id })
      .expect(201);
    expect(secondLink.body.replacedCoinId).toBe(firstCoin.id);
    expect(secondLink.body.coin.slotId).toBe(slot.id);

    const displaced = await prisma.coinItem.findUniqueOrThrow({ where: { id: firstCoin.id } });
    expect(displaced.slotId).toBeNull();

    const occupant = await prisma.coinItem.findUniqueOrThrow({ where: { id: secondCoin.id } });
    expect(occupant.slotId).toBe(slot.id);
  });
});
