import { Controller, Get, INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { CurrentUser } from '../src/auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../src/auth/strategies/jwt.strategy';
import { PrismaService } from '../src/prisma/prisma.service';

// Not built yet as of backlog 2.5 (Sets/UserSets/Coins are still empty stubs) — stand-in
// non-@Public() route so the test can exercise the global JwtAuthGuard end to end.
@Controller('__test-protected')
class ProtectedTestController {
  @Get()
  whoami(@CurrentUser() user: AuthenticatedUser) {
    return user;
  }
}

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `e2e-auth-${Date.now()}@example.com`;
  const password = 'correct-horse-battery-staple';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ProtectedTestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('registers, logs in, and hits a guarded route with the returned token', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ email, password })
      .expect(201)
      .expect((res) => {
        expect(res.body).toMatchObject({ email });
        expect(res.body.passwordHash).toBeUndefined();
      });

    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const { accessToken } = loginRes.body;
    expect(typeof accessToken).toBe('string');

    await request(app.getHttpServer()).get('/api/v1/__test-protected').expect(401);

    await request(app.getHttpServer())
      .get('/api/v1/__test-protected')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({ email });
      });
  });

  it('rejects login with the wrong password with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email, password: 'not-the-right-password' })
      .expect(401);
  });
});
