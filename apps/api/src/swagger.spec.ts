import type { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { IS_PUBLIC_KEY } from './auth/decorators/public.decorator';
import { OptionalJwtAuthGuard } from './auth/guards/optional-jwt-auth.guard';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { configureApp } from './configure-app';
import { SetsController } from './sets/sets.controller';
import { SetsService } from './sets/sets.service';
import { OPENAPI_JSON_PATH, SWAGGER_UI_PATH, setupSwagger } from './swagger';

interface Operation {
  security?: unknown;
}
interface OpenApiDoc {
  paths: Record<string, { get?: Operation }>;
}

const PUBLIC_GETS = [
  '/api/v1/catalog',
  '/api/v1/catalog/{id}',
  '/api/v1/catalog/facets',
  '/api/v1/sets/canonical',
  '/api/v1/sets/canonical/{id}',
  '/api/v1/sets/public',
  '/api/v1/sets/public/{id}',
];

describe('setupSwagger', () => {
  const originalHops = process.env.TRUST_PROXY_HOPS;
  let app: NestExpressApplication;
  let returned: unknown;

  beforeAll(async () => {
    delete process.env.TRUST_PROXY_HOPS;
    const moduleRef = await Test.createTestingModule({
      controllers: [CatalogController, SetsController],
      providers: [
        { provide: CatalogService, useValue: {} },
        { provide: SetsService, useValue: {} },
      ],
    })
      .overrideGuard(OptionalJwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureApp(app);
    returned = setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    if (originalHops === undefined) {
      delete process.env.TRUST_PROXY_HOPS;
    } else {
      process.env.TRUST_PROXY_HOPS = originalHops;
    }
  });

  it('exports the fixed paths', () => {
    expect(OPENAPI_JSON_PATH).toBe('api/docs-json');
    expect(SWAGGER_UI_PATH).toBe('api/docs');
  });

  it('returns the OpenAPI document it created', () => {
    expect(returned).toEqual(expect.objectContaining({ openapi: expect.any(String), paths: expect.any(Object) }));
  });

  it('serves the JSON at /api/docs-json without a token', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/json');
    expect(res.body.openapi).toEqual(expect.any(String));
    expect(res.body.info.title).toEqual(expect.any(String));
  });

  it('keeps the Swagger UI at /api/docs', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  it('does not serve the document under the global prefix', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/docs-json');
    expect(res.status).toBe(404);
  });

  it.each(PUBLIC_GETS)('marks GET %s with security []', async (path) => {
    const res = await request(app.getHttpServer()).get('/api/docs-json');
    const doc = res.body as OpenApiDoc;
    expect(doc.paths[path]?.get).toBeDefined();
    expect(doc.paths[path].get?.security).toEqual([]);
  });

  it('keeps the bearer requirement on non-public operations', async () => {
    const res = await request(app.getHttpServer()).get('/api/docs-json');
    const doc = res.body as OpenApiDoc;
    expect(doc.paths['/api/v1/sets']?.get?.security).toEqual([{ bearer: [] }]);
    expect(doc.paths['/api/v1/sets/summary']?.get?.security).toEqual([{ bearer: [] }]);
  });

  it('keeps @Public metadata on the seven public handlers', () => {
    const handlers = [
      CatalogController.prototype.findAll,
      CatalogController.prototype.findFacets,
      CatalogController.prototype.findOne,
      SetsController.prototype.findAllCanonical,
      SetsController.prototype.findCanonicalById,
      SetsController.prototype.findAllPublic,
      SetsController.prototype.findPublicById,
    ];
    for (const handler of handlers) {
      expect(Reflect.getMetadata(IS_PUBLIC_KEY, handler)).toBe(true);
    }
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, SetsController.prototype.findAll)).toBeUndefined();
  });
});
