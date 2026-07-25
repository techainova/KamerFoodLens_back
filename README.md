# KmerFoodLens (KFL) Backend

Complete NestJS v10 backend for **KmerFoodLens**, a Cameroonian food recognition mobile app.

## Stack

- **Runtime**: Node.js 20 LTS, TypeScript 5.x (strict mode, zero `any`)
- **Framework**: NestJS v10 on the **Fastify** adapter
- **Relational DB**: PostgreSQL 15 via Prisma v5 (users, restaurants, orders, payments, events, courses, games, forum, pro/admin)
- **Document DB**: MongoDB 7 via Mongoose 8 (scan results, food journal, community feed & stories)
- **Cache / sessions / rate limiting**: Redis 7 via ioredis
- **Auth**: Passport.js, JWT RS256 (access 15m / refresh 7d, rotated in Redis), Google OAuth2
- **Validation**: class-validator / class-transformer on every DTO
- **Docs**: `@nestjs/swagger` — OpenAPI 3.0 at `/api/docs`
- **Realtime**: Socket.io (`@nestjs/websockets`) — order status updates, live event chat
- **GraphQL**: `@nestjs/graphql` + Apollo Server — Pro & Admin dashboards only, schema at `src/schema.gql`
- **Background jobs**: Bull + `@nestjs/bull` (push notifications, payouts)
- **Object storage**: AWS S3 (v3 SDK) — scan photos, menu images, avatars
- **Encryption**: Node.js built-in `crypto` — AES-256-GCM for sensitive payloads

## Security

- **TLS 1.3 only** — enforced at the nginx / load-balancer level in front of this service (not in-process). Terminate TLS upstream and forward plain HTTP to the Fastify listener.
- **AES-256-GCM decryption middleware** on `POST /scan/image`, `POST /scan/audio`, `POST /scan/text`, `POST /payments/initiate`.
  Clients must send:
  - Header `X-KFL-IV` — hex-encoded initialization vector
  - Header `X-KFL-TAG` — hex-encoded GCM auth tag
  - Body — hex-encoded ciphertext (JSON payload after decryption)
  - Key: `ENCRYPTION_KEY` (32-byte hex, from env)
- **JWT RS256** — 15 minute access tokens, 7 day refresh tokens rotated and revocable via Redis.
- **Role-based guards** — `@Roles('standard' | 'pro' | 'admin')` combined with a global `RolesGuard`.
- **Rate limiting** — `@nestjs/throttler`, 60 req/min per IP globally, 10 req/min on `/auth/*`.
- **Helmet** security headers, **CORS** whitelist from `ALLOWED_ORIGINS`.
- JWT auth guard is global (`APP_GUARD`); mark public routes with `@Public()`.

## Getting started

```bash
npm install
cp .env.example .env   # fill in real secrets
docker compose up -d postgres mongodb redis
npx prisma migrate dev
npx prisma db seed
npm run start:dev
```

- REST API: `http://localhost:3000`
- Swagger docs: `http://localhost:3000/api/docs`
- GraphQL playground (Pro/Admin only, non-production): `http://localhost:3000/graphql`

## Project layout

```
prisma/            PostgreSQL schema (Prisma) + seed script
src/
  main.ts          Fastify bootstrap: Helmet, CORS, Swagger, global ValidationPipe
  app.module.ts     Root module wiring every feature module + global guards/filters/interceptors
  config/          @nestjs/config + Joi env validation
  common/          Decorators, guards, middleware (AES-GCM), filters, interceptors, S3 upload service
  prisma/          PrismaService (extends PrismaClient, shutdown hooks)
  redis/           Shared ioredis client (REDIS_CLIENT token)
  jobs/            Bull processors: push notifications, payouts
  modules/
    auth/          Register, login, OTP, refresh rotation, Google OAuth2
    users/         Profile, badges, notifications, favorites, food journal (Mongo)
    scan/          Image/audio/text dish recognition via AI_SERVICE_URL, scan history (Mongo)
    restaurants/   Geo-search (Haversine), menus, reviews
    orders/        Order lifecycle + Socket.io status updates
    payments/      CinetPay / Stripe / wallet, webhooks, transaction history
    events/        Events + Socket.io live chat
    courses/       Courses, lessons, enrollment, progress tracking
    games/         Quiz, XP/leaderboard (Redis sorted sets), tombola
    community/     Posts/stories (Mongo), forum threads/replies (Postgres)
    pro/           Pro dashboard/analytics (REST + GraphQL)
    admin/         Platform administration (REST + GraphQL)
```

## Response shape

Every successful response is wrapped by the global `TransformInterceptor`:

```json
{ "data": { /* ... */ }, "meta": { "page": 1, "total": 42 } }
```

## Environment variables

See `.env.example` for the full list (database URLs, JWT keys, encryption key, SMTP, CinetPay, Stripe, AWS S3, FCM, Google OAuth2).
