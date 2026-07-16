import 'reflect-metadata';
import helmet from 'helmet';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';
import { APP_CONFIG, type AppConfig } from './config';

export async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bodyParser: false });
  const config = app.get<AppConfig>(APP_CONFIG);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'same-site' } }));
  app.useBodyParser('json', { limit: config.REQUEST_BODY_LIMIT, strict: true });
  const origins = config.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean);
  if (origins.length > 0) app.enableCors({ origin: origins, methods: ['GET', 'POST', 'PUT', 'DELETE'], allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'], exposedHeaders: ['Idempotency-Replayed', 'X-Request-Id'], maxAge: 600 });
  app.useGlobalFilters(new ApiExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(config.PORT, '0.0.0.0');
  return app;
}

if (require.main === module) void bootstrap();
