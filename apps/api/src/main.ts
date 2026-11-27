// Import first: Sentry has to instrument modules before they load.
import './instrument';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './configure-app';
import { setupSwagger } from './swagger';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  configureApp(app);

  setupSwagger(app);

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
