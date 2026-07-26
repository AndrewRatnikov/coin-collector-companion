import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

// The one behavior a mocked-Prisma unit test structurally can't verify: the global
// JwtAuthGuard actually rejecting an unauthenticated POST /catalog (docs/backlog_catalog-contributions.md 1.8).
describe('Catalog submission (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rejects an unauthenticated POST /catalog with 401', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/catalog')
      .send({ country: 'USA', denomination: 'Cent', name: 'Test Coin', year: 1950 })
      .expect(401);
  });
});
