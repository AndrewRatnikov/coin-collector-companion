import { Test } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

const LOGIN_BODY = { email: 'rate-limit-nobody@example.com', password: 'not-a-real-password' };
const CATALOG_BODY = {
  country: 'USA',
  denomination: 'Cent',
  name: 'Rate Limit Test Coin',
  year: 1950,
};

describe('Rate limiting (e2e)', () => {
  const original = process.env.TRUST_PROXY_HOPS;
  let app: NestExpressApplication;

  const build = async (hops: string | undefined) => {
    const moduleFixture = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication<NestExpressApplication>();
    if (hops === undefined) {
      delete process.env.TRUST_PROXY_HOPS;
    } else {
      process.env.TRUST_PROXY_HOPS = hops;
    }
    configureApp(app);
    await app.init();
  };

  const login = (xff: string) =>
    request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('X-Forwarded-For', xff)
      .send(LOGIN_BODY);

  afterEach(async () => {
    await app.close();
    if (original === undefined) {
      delete process.env.TRUST_PROXY_HOPS;
    } else {
      process.env.TRUST_PROXY_HOPS = original;
    }
  });

  it('TRUST_PROXY_HOPS=1: separate buckets per X-Forwarded-For client', async () => {
    await build('1');
    for (let i = 0; i < 5; i++) {
      const res = await login('203.0.113.10');
      expect(res.status).not.toBe(429);
    }
    expect((await login('203.0.113.10')).status).toBe(429);
    expect((await login('203.0.113.20')).status).not.toBe(429);
  });

  it('TRUST_PROXY_HOPS=0: X-Forwarded-For is ignored, one shared bucket', async () => {
    await build('0');
    for (let i = 0; i < 5; i++) {
      const res = await login('203.0.113.10');
      expect(res.status).not.toBe(429);
    }
    expect((await login('203.0.113.20')).status).toBe(429);
  });

  it('POST /catalog: 21st request within the window returns 429', async () => {
    await build(undefined);
    for (let i = 0; i < 20; i++) {
      const res = await request(app.getHttpServer()).post('/api/v1/catalog').send(CATALOG_BODY);
      expect(res.status).toBe(401);
    }
    const res = await request(app.getHttpServer()).post('/api/v1/catalog').send(CATALOG_BODY);
    expect(res.status).toBe(429);
  });
});
