import { Logger, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { configureApp, parseTrustProxyHops } from './configure-app';
import { HealthController } from './health/health.controller';

describe('parseTrustProxyHops', () => {
  it.each([
    [undefined, { hops: 0, invalid: false }],
    ['', { hops: 0, invalid: false }],
    ['0', { hops: 0, invalid: false }],
    ['1', { hops: 1, invalid: false }],
    ['2', { hops: 2, invalid: false }],
    ['abc', { hops: 0, invalid: true }],
    ['-1', { hops: 0, invalid: true }],
    ['1.5', { hops: 0, invalid: true }],
    ['true', { hops: 0, invalid: true }],
  ])('parses %j', (raw, expected) => {
    expect(parseTrustProxyHops(raw)).toEqual(expected);
  });

  it('trims surrounding whitespace', () => {
    expect(parseTrustProxyHops(' 2 ')).toEqual({ hops: 2, invalid: false });
  });
});

describe('configureApp', () => {
  const original = process.env.TRUST_PROXY_HOPS;
  let warnSpy: jest.SpyInstance;

  const makeApp = () => {
    const app = {
      set: jest.fn(),
      use: jest.fn(),
      enableCors: jest.fn(),
      setGlobalPrefix: jest.fn(),
      useGlobalPipes: jest.fn(),
    };
    return { app, typed: app as unknown as NestExpressApplication };
  };

  beforeEach(() => {
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    warnSpy.mockRestore();
    if (original === undefined) {
      delete process.env.TRUST_PROXY_HOPS;
    } else {
      process.env.TRUST_PROXY_HOPS = original;
    }
  });

  it('sets trust proxy to 0 when unset, without warning', () => {
    delete process.env.TRUST_PROXY_HOPS;
    const { app, typed } = makeApp();
    configureApp(typed);
    expect(app.set).toHaveBeenCalledTimes(1);
    expect(app.set).toHaveBeenCalledWith('trust proxy', 0);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('sets trust proxy to 1 for "1" and 2 for "2"', () => {
    process.env.TRUST_PROXY_HOPS = '1';
    const first = makeApp();
    configureApp(first.typed);
    expect(first.app.set).toHaveBeenCalledWith('trust proxy', 1);

    process.env.TRUST_PROXY_HOPS = '2';
    const second = makeApp();
    configureApp(second.typed);
    expect(second.app.set).toHaveBeenCalledWith('trust proxy', 2);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it.each(['abc', '-1'])('falls back to 0 and warns once for %j', (bad) => {
    process.env.TRUST_PROXY_HOPS = bad;
    const { app, typed } = makeApp();
    configureApp(typed);
    expect(app.set).toHaveBeenCalledWith('trust proxy', 0);
    const proxyCalls = app.set.mock.calls.filter((call: unknown[]) => call[0] === 'trust proxy');
    expect(proxyCalls).toHaveLength(1);
    expect(typeof proxyCalls[0][1]).toBe('number');
    expect(proxyCalls[0][1]).toBe(0);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(String(warnSpy.mock.calls[0][0])).toContain('TRUST_PROXY_HOPS');
  });

  it('applies prefix, validation pipe, cors, helmet and cookie parser', () => {
    delete process.env.TRUST_PROXY_HOPS;
    const { app, typed } = makeApp();
    configureApp(typed);
    expect(app.setGlobalPrefix).toHaveBeenCalledWith('api/v1');
    expect(app.useGlobalPipes).toHaveBeenCalledTimes(1);
    expect(app.useGlobalPipes.mock.calls[0][0]).toBeInstanceOf(ValidationPipe);
    expect(app.enableCors).toHaveBeenCalledWith(
      expect.objectContaining({ credentials: true, origin: expect.any(Array) }),
    );
    expect(app.use).toHaveBeenCalledTimes(2);
    expect(app.use.mock.calls[0][0]).toBeInstanceOf(Function);
    expect(app.use.mock.calls[1][0]).toBeInstanceOf(Function);
  });
});

describe('configureApp security headers', () => {
  const original = process.env.TRUST_PROXY_HOPS;
  const ORIGIN = 'http://localhost:3000';
  let app: NestExpressApplication;

  beforeAll(async () => {
    delete process.env.TRUST_PROXY_HOPS;
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (original === undefined) {
      delete process.env.TRUST_PROXY_HOPS;
    } else {
      process.env.TRUST_PROXY_HOPS = original;
    }
  });

  it('GET /api/v1/health carries the helmet headers and no X-Powered-By', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').set('Origin', ORIGIN);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });

    const csp = res.headers['content-security-policy'];
    expect(csp).toBeDefined();
    const directives = csp.split(';').map((d: string) => d.trim());
    expect(directives).toContain("script-src 'self'");
    expect(directives).toContain("default-src 'self'");
    expect(directives).toContain("object-src 'none'");
    expect(directives).toContain("frame-ancestors 'self'");
    const scriptSrc = directives.find((d: string) => d.startsWith('script-src '));
    expect(scriptSrc).not.toContain('unsafe-inline');
    expect(scriptSrc).not.toContain('unsafe-eval');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
    expect(res.headers['referrer-policy']).toBe('no-referrer');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('keeps credentialed CORS for the web origin next to the helmet headers', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/health').set('Origin', ORIGIN);

    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('answers the CORS preflight with 204 and credentials allowed', async () => {
    const res = await request(app.getHttpServer())
      .options('/api/v1/health')
      .set('Origin', ORIGIN)
      .set('Access-Control-Request-Method', 'POST');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe(ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not echo an unknown origin', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/health')
      .set('Origin', 'http://evil.example.com');

    expect(res.headers['access-control-allow-origin']).not.toBe('http://evil.example.com');
  });
});
