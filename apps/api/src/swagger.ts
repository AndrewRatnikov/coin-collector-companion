import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger';

/** Swagger UI, outside the api/v1 global prefix. */
export const SWAGGER_UI_PATH = 'api/docs';
/**
 * The OpenAPI JSON, at a fixed public URL that llms.txt links to. Registered on the HTTP adapter,
 * so no Nest guard applies and it needs no token.
 */
export const OPENAPI_JSON_PATH = 'api/docs-json';

/** Call after configureApp(app), so the document's paths carry the /api/v1 prefix. */
export function setupSwagger(app: INestApplication): OpenAPIObject {
  const config = new DocumentBuilder()
    .setTitle('Coin Collector Companion API')
    .setDescription('Gap-view collection tracker API')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup(SWAGGER_UI_PATH, app, document, { jsonDocumentUrl: OPENAPI_JSON_PATH });
  return document;
}
