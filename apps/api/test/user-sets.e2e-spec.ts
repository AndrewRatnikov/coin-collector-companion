import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

// Exercises backlog 3.1-3.4 end to end against the real seeded templates
// (prisma db seed) rather than fixture data — activation and the gap-free
// 0% summary only mean something against a template with real slots.
describe('UserSets (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `e2e-user-sets-${Date.now()}@example.com`;
  const password = 'correct-horse-battery-staple';
  let accessToken: string;
  let userId: string;
  let templateSetId: string;
  let templateTotalSlots: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);

    const template = await prisma.collectionSet.findFirst({
      where: { isTemplate: true },
      include: { _count: { select: { slots: true } } },
    });
    if (!template) {
      throw new Error(
        'No seeded template found — run `pnpm --filter api exec prisma db seed` before this test',
      );
    }
    templateSetId = template.id;
    templateTotalSlots = template._count.slots;

    const registerRes = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password });
    userId = registerRes.body.id;

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);
    accessToken = loginRes.body.accessToken;
  }, 20_000);

  afterAll(async () => {
    // UserSet.userId is RESTRICT, not CASCADE — the pursuit row must go first.
    await prisma.userSet.deleteMany({ where: { userId } });
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('activates a template idempotently and lists it at 0% owned', async () => {
    const firstActivate = await request(app.getHttpServer())
      .post(`/api/v1/sets/${templateSetId}/activate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const secondActivate = await request(app.getHttpServer())
      .post(`/api/v1/sets/${templateSetId}/activate`)
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    // Idempotent: same UserSet row both times, no duplicate created.
    expect(secondActivate.body.id).toBe(firstActivate.body.id);
    expect(secondActivate.body.activatedAt).toBe(firstActivate.body.activatedAt);

    const userSetCount = await prisma.userSet.count({
      where: { setId: templateSetId, userId },
    });
    expect(userSetCount).toBe(1);

    const listRes = await request(app.getHttpServer())
      .get('/api/v1/user-sets')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);

    const summary = listRes.body.find(
      (entry: { userSetId: string }) => entry.userSetId === firstActivate.body.id,
    );
    expect(summary).toBeDefined();
    expect(summary.set.id).toBe(templateSetId);
    expect(summary.totalSlots).toBe(templateTotalSlots);
    expect(summary.ownedSlots).toBe(0);
    expect(summary.isComplete).toBe(false);
  });
});
