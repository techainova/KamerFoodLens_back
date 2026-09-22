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
  // Fastify's default bodyLimit is 1 MiB — far too small once a request carries
  // base64-encoded media (avatar photos, menu item photos, post/story carousels
  // of up to 10 images). Base64 alone inflates raw bytes by ~33%, so even a
  // single normal camera photo routinely exceeds the default and gets rejected
  // with a silent 413 before it reaches any route handler.
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter({
    bodyLimit: 50 * 1024 * 1024,
  }), {
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

  // Many "action" endpoints take no DTO (follow/unfollow, event/course
  // register-unregister, order cancel, like, mark-viewed…). The frontend's
  // axios instance sends `Content-Type: application/json` on every request by
  // default, even with no data — Fastify's stock JSON parser throws a 500
  // ("Body cannot be empty...") when it's handed that content-type on a
  // zero-length body instead of just treating it as absent. Strip the header
  // before Fastify's parser sees it in that one case, so it falls back to its
  // normal "no body" behaviour — exactly as if the client had sent nothing.
  // (Registering a competing 'application/json' content-type parser here
  // instead would collide with the one @nestjs/platform-fastify registers
  // for itself during app.init(), crashing the server on boot.)
  app.getHttpAdapter().getInstance().addHook('onRequest', (request, _reply, done) => {
    const contentLength = request.headers['content-length'];
    const contentType = request.headers['content-type'];
    if ((!contentLength || contentLength === '0') && contentType?.includes('application/json')) {
      delete request.headers['content-type'];
    }
    done();
  });

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
