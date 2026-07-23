import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/api-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const allowedOrigins =
    configuredOrigins.length > 0
      ? configuredOrigins
      : process.env.NODE_ENV === 'production'
        ? []
        : ['http://localhost:5173'];

  app.enableCors({
    origin: allowedOrigins,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Authorization', 'Content-Type'],
    credentials: false,
    maxAge: 600,
  });
  app.useGlobalFilters(new ApiExceptionFilter());
  await app.listen(process.env.PORT || 3000, '0.0.0.0');
}

bootstrap();
