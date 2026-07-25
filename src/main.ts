import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';

import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter(), {
    rawBody: true,
  });

  // AES-256-GCM encrypted routes (/scan/*, /payments/initiate) send the ciphertext
  // as a raw hex string with Content-Type: text/plain — Fastify has no built-in
  // parser for that content type, so without this the body arrives as `undefined`
  // and AesDecryptGuard always rejects the request.
  app.getHttpAdapter().getInstance().addContentTypeParser(
    'text/plain',
    { parseAs: 'string' },
    (_req: unknown, body: string, done: (err: Error | null, body?: string) => void) => {
      done(null, body);
    },
  );

  const configService = app.get(ConfigService);

  await app.register(helmet, {
    contentSecurityPolicy: false,
  });

  const allowedOrigins = (configService.get<string>('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

  await app.register(cors, {
    origin: allowedOrigins,
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('KmerFoodLens API')
    .setDescription('Complete backend API for the KmerFoodLens (KFL) Cameroonian food recognition platform')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const prismaService = app.get(PrismaService);
  await prismaService.enableShutdownHooks(app);

  const port = configService.get<number>('PORT') ?? 3000;
  await app.listen(port, '0.0.0.0');
  // eslint-disable-next-line no-console
  console.log(`KmerFoodLens API listening on port ${port}`);
}

void bootstrap();
