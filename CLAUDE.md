# CLAUDE.md — KFL Backend (kfl_back)

## Mission
Tu dois créer le backend complet de KmerFoodLens dans ce dossier (`C:\Users\guinb\kfl_back`).
Crée TOUS les fichiers listés ci-dessous sans demander de confirmation.
Utilise les outils Bash, Write, Edit librement — les permissions sont pré-autorisées.

## Règles de travail
- Crée d'abord la structure de dossiers, puis les fichiers un par un
- Ne demande jamais de confirmation avant d'écrire un fichier
- Si une commande npm/pnpm est nécessaire, exécute-la directement
- TypeScript STRICT sur tout le projet — zéro `any`
- Génère le code COMPLET, sans placeholder ni TODO

---

## PROMPT COMPLET DE CRÉATION

You are a senior Node.js architect. Create a complete NestJS v10 backend for KmerFoodLens (KFL),
a Cameroonian food recognition mobile app. Follow this specification exactly.
Write ALL files completely — no placeholders, no "// implement later", no TODOs.
Working directory: C:\Users\guinb\kfl_back

---

## STACK OBLIGATOIRE
- Node.js 20 LTS + TypeScript 5.x strict (noImplicitAny, strictNullChecks)
- NestJS v10 (Fastify adapter — NOT Express)
- Prisma v5 — PostgreSQL 15 (main relational DB)
- Mongoose 8 — MongoDB 7 (scan results, food journal, community feeds)
- ioredis + Redis 7 (cache, sessions, rate limiting)
- Passport.js — JWT RS256 (access 15min, refresh 7d; keys from env)
- class-validator + class-transformer on every DTO
- @nestjs/swagger — auto-generate OpenAPI 3.0 at /api/docs
- Socket.io via @nestjs/websockets (orders, notifications)
- @nestjs/graphql + Apollo Server — for Pro & Admin dashboards ONLY
- bull + @nestjs/bull — background jobs (push, payouts, AI queue)
- aws-sdk v3 — S3 for image upload (scan photos, menus, avatars)
- node-forge — AES-256-GCM decryption of incoming encrypted payloads

---

## SECURITY (non-negotiable)

1. TLS 1.3 only (enforced at nginx/load-balancer level — document in README)
2. AES-256-GCM decryption middleware on routes:
   POST /scan/image, POST /scan/audio, POST /scan/text, POST /payments/initiate
   - Expect header: X-KFL-IV (hex), X-KFL-TAG (hex)
   - Body is hex-encoded ciphertext
   - Key from env: ENCRYPTION_KEY (32-byte hex)
3. JWT RS256:
   - Private key: JWT_PRIVATE_KEY (PEM, env)
   - Public key: JWT_PUBLIC_KEY (PEM, env)
   - Access token: 15 minutes
   - Refresh token: 7 days, stored in Redis, rotatable
4. Role-based guards: @Roles('standard' | 'pro' | 'admin')
5. Rate limiting: @nestjs/throttler — 60 req/min per IP globally; 10 req/min on auth routes
6. Helmet for security headers
7. CORS: whitelist from env ALLOWED_ORIGINS

---

## MODULES (create all 12)

### 1. AuthModule — /auth
- POST /auth/register { email, password, firstName, lastName, phone?, username?, isBusiness }
  → creates User (standard role), sends OTP email via nodemailer
- POST /auth/login { email, password } → { accessToken, refreshToken, user }
- POST /auth/otp/verify { email, otp } → marks email verified
- POST /auth/otp/resend { email }
- POST /auth/refresh { refreshToken } → new token pair (refresh rotation)
- POST /auth/logout { refreshToken } → revoke in Redis
- POST /auth/forgot-password { email }
- POST /auth/reset-password { token, newPassword }
- POST /auth/google (Google OAuth2 via passport-google-oauth20)
- Prisma models: User { id, email, passwordHash, firstName, lastName, username,
    phone, avatar, bio, location, role, isEmailVerified, isActive, createdAt }

### 2. UsersModule — /users
- GET  /users/me — own profile (JWT required)
- PATCH /users/me — update profile
- GET  /users/badges — all badges with isEarned flag per user
- GET  /users/notifications?page — paginated, unreadCount
- PATCH /users/notifications/read/:id
- PATCH /users/notifications/read — mark all read
- GET  /users/favorites — FavoriteItem[]
- POST /users/favorites { type, itemId }
- DELETE /users/favorites/:id
- GET  /users/journal?date — JournalEntry[] (MongoDB)
- POST /users/journal — add journal entry
- DELETE /users/journal/:id

### 3. ScanModule — /scan  [AES-256-GCM on all 3 POST routes]
- POST /scan/image — multipart or base64 image → call Python FastAPI service
    (env: AI_SERVICE_URL), return { dishId, dishName, confidence, alternatives[], nutritionFacts }
- POST /scan/audio — audio blob → AI service → same response shape
- POST /scan/text  — { query: string } → text-based dish lookup
- GET  /scan/history?page — MongoDB scan history for current user
- Mongoose model: ScanResult { userId, dishId, dishName, confidence, imageUrl,
    scanType, createdAt }

### 4. RestaurantsModule — /restaurants
- GET  /restaurants?lat&lng&radius&cuisine&page — PostGIS geo-search
- GET  /restaurants/:id
- GET  /restaurants/:id/menu — menu items with availability
- POST /restaurants/:id/reviews { rating, comment } (standard users)
- GET  /restaurants/:id/reviews?page
- Prisma models: Restaurant { id, ownerId(FK User), name, description, cuisineType,
    address, lat, lng, phone, avatar, coverUrl, isActive, isVerified }
    MenuItem { id, restaurantId, name, description, priceXAF, category, imageUrl, isAvailable }
    Review { id, userId, restaurantId, rating, comment, createdAt }

### 5. OrdersModule — /orders
- POST /orders — create order { restaurantId, items[{menuItemId, qty}], mode, note, reservationAt? }
- GET  /orders — own order history
- GET  /orders/:id
- PATCH /orders/:id/cancel
- WebSocket event: order:status_update → emit to user room
- Prisma models: Order { id, ref(unique), userId, restaurantId, status, mode,
    totalXAF, kflFeeXAF, note, reservationAt, createdAt }
    OrderItem { id, orderId, menuItemId, name, priceXAF, qty }

### 6. PaymentsModule — /payments  [AES-256-GCM on /payments/initiate]
- POST /payments/initiate { orderId, method: 'cinetpay'|'stripe'|'wallet' }
    → CinetPay or Stripe charge → return { paymentUrl?, paymentIntentId? }
- POST /payments/webhook/cinetpay — CinetPay IPN
- POST /payments/webhook/stripe — Stripe webhook (signature verify)
- GET  /payments/wallet — wallet balance
- POST /payments/wallet/topup { amount, method }
- GET  /payments/transactions?page — TransactionHistory[]
- Prisma models: Payment { id, orderId, userId, method, status, amountXAF,
    externalRef, createdAt }
    Wallet { id, userId(unique), balanceXAF }
    Transaction { id, walletId, type, amountXAF, description, createdAt }

### 7. EventsModule — /events
- GET  /events?category&page
- GET  /events/:id
- POST /events/:id/register — register user
- DELETE /events/:id/register — unregister
- WebSocket: event:live → join room, receive chat messages
- Pro-only: POST /events (create), PATCH /events/:id, DELETE /events/:id
- Prisma models: Event { id, organizerId(FK User), title, description, category,
    imageUrl, location, isOnline, streamUrl, startAt, endAt, priceXAF, maxSeats, createdAt }
    EventRegistration { id, eventId, userId, createdAt }

### 8. CoursesModule — /courses
- GET  /courses?page
- GET  /courses/:id
- POST /courses/:id/enroll — enroll (free or after payment)
- GET  /courses/:id/progress — LessonProgress[] for current user
- PATCH /courses/:id/lessons/:lessonId/complete
- Pro-only: POST /courses (create), PATCH /courses/:id
- Prisma models: Course { id, instructorId, title, description, priceXAF, imageUrl,
    level, isCertified, createdAt }
    Lesson { id, courseId, title, videoUrl, duration, order, sectionTitle }
    Enrollment { id, courseId, userId, paidAt }
    LessonProgress { id, enrollmentId, lessonId, completedAt }

### 9. GamesModule — /games
- GET  /games/leaderboard?period=week|month|all
- GET  /games/quiz/questions?category&count
- POST /games/quiz/submit { sessionId, answers[{questionId, selectedIndex, timeMs}] }
    → { score, total, xpEarned, correctAnswers }
- GET  /games/tombola — active tombola info
- GET  /games/tombola/tickets?tombolaId
- POST /games/tombola/buy { tombolaId, qty } → charge wallet → TombolaTicket[]
- XP system: award XP on scan, quiz, order, review; update leaderboard in Redis
- Prisma models: UserXP { id, userId(unique), points, level }
    LeaderboardEntry { userId, period, points, rank, updatedAt }
    QuizQuestion { id, question, options(Json), correctIndex, category, difficulty }
    Tombola { id, title, drawAt, pricePerTicketXAF, maxTickets, prizes(Json), isActive }
    TombolaTicket { id, tombolaId, userId, ticketNumber, purchasedAt }
    Badge { id, name, nameEN, description, descriptionEN, icon, color, category, xpReward }
    UserBadge { id, badgeId, userId, earnedAt }

### 10. CommunityModule — /community
- GET  /community/posts?page — MongoDB feed
- POST /community/posts { content, imageUrl?, type: 'post'|'recipe'|'review' }
- POST /community/posts/:id/like
- POST /community/posts/:id/comments { text }
- GET  /community/forum?page — Forum threads (PostgreSQL)
- GET  /community/forum/:id
- POST /community/forum { title, content, tags[] }
- POST /community/forum/:id/reply { content }
- GET  /community/stories?page — ephemeral stories (MongoDB, TTL 24h)
- Mongoose models: Post { userId, content, imageUrl, type, likes[], comments[], createdAt }
    Story { userId, imageUrl, expiresAt }
- Prisma models: ForumThread { id, userId, title, content, tags, views, createdAt }
    ForumReply { id, threadId, userId, content, createdAt }

### 11. AdminModule — /admin  [role: admin only]

GraphQL schema (alongside REST):
- Query: adminDashboard, adminUsers(filter, page), adminProList(status),
    adminOrders(status, page), adminFinance, adminLogs(level, page)
- Mutation: approveProRequest(userId), rejectProRequest(userId, reason),
    suspendUser(userId, days), banUser(userId), approvePayout(payoutId),
    sendPushNotification(target, title, body), setMaintenanceMode(enabled),
    setCommissionRate(percent)

REST endpoints:
- GET  /admin/dashboard — stats summary
- GET  /admin/users?filter&page
- GET  /admin/users/:id
- PATCH /admin/users/:id/suspend { days }
- PATCH /admin/users/:id/ban
- GET  /admin/pro-requests?status
- PATCH /admin/pro-requests/:id/approve
- PATCH /admin/pro-requests/:id/reject { reason }
- GET  /admin/orders?status&page
- GET  /admin/finance
- GET  /admin/payouts?status
- PATCH /admin/payouts/:id/approve
- POST /admin/push { target: 'all'|'standard'|'pro'|string, title, body }
- GET  /admin/logs?level&page
- GET  /admin/settings
- PATCH /admin/settings { maintenanceMode?, registrationsOpen?, aiEnabled?, commissionPct? }
- GET  /admin/tombola
- POST /admin/tombola/draw — trigger draw, pick winners, notify via FCM

### 12. ProModule — /pro  [role: pro only]

GraphQL schema (alongside REST):
- Query: proDashboard, proOrders(status, page), proAnalytics(period), proMessages(page)
- Mutation: createPromo, updateOrderStatus(orderId, status), requestPayout(amountXAF)

REST endpoints:
- GET  /pro/dashboard → ProStats { revenueXAF, revenueChange, ordersCount, ordersChange,
    customersCount, avgOrderXAF, activeMenuItems, rating }
- POST /pro/upgrade { businessName, businessType, phone, address, description }
    → creates ProRequest (pending admin approval)
- GET  /pro/revenues?period=week|month|year
- GET  /pro/analytics?period=week|month|year
- GET  /pro/messages?page
- GET  /pro/promos
- POST /pro/promos { title, discountPercent?, discountXAF?, validFrom, validUntil }
- GET  /pro/orders?status&page → { items: ProOrderSummary[], total: number }
- GET  /pro/subscription
- Prisma models: ProRequest { id, userId, businessName, businessType, phone,
    address, description, status, rejectionReason, createdAt }
    ProProfile { id, userId(unique), businessName, rating, totalOrders, totalRevenueXAF }

---

## ENVIRONMENT VARIABLES — generate .env.example with all of these:
```
PORT=3000
DATABASE_URL=postgresql://kfl:kfl_secret@localhost:5432/kfl
MONGODB_URI=mongodb://localhost:27017/kfl
REDIS_URL=redis://localhost:6379

JWT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n...\n-----END RSA PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
JWT_REFRESH_SECRET=your_refresh_secret_here

ENCRYPTION_KEY=your_32_byte_hex_key_here

AI_SERVICE_URL=http://localhost:8000

SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
SMTP_FROM="KmerFoodLens <noreply@kmerfooodlens.com>"

CINETPAY_API_KEY=your_cinetpay_api_key
CINETPAY_SITE_ID=your_cinetpay_site_id

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

AWS_ACCESS_KEY_ID=your_key_id
AWS_SECRET_ACCESS_KEY=your_secret
AWS_S3_BUCKET=kfl-media
AWS_REGION=eu-west-3

ALLOWED_ORIGINS=http://localhost:3000,https://app.kmerfooodlens.com

FCM_SERVER_KEY=your_firebase_server_key
```

---

## COMPLETE FILE STRUCTURE TO GENERATE

```
C:\Users\guinb\kfl_back\
├── package.json
├── tsconfig.json
├── tsconfig.build.json
├── nest-cli.json
├── .env.example
├── docker-compose.yml
├── Dockerfile
├── README.md
├── prisma/
│   ├── schema.prisma          ← COMPLETE schema, all models
│   └── seed.ts                ← seed badges, quiz questions
├── src/
│   ├── main.ts                ← Fastify + Helmet + CORS + Swagger + ValidationPipe
│   ├── app.module.ts          ← all module imports
│   ├── config/
│   │   └── config.module.ts   ← @nestjs/config + joi validation
│   ├── common/
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts
│   │   │   └── current-user.decorator.ts
│   │   ├── guards/
│   │   │   ├── jwt-auth.guard.ts
│   │   │   └── roles.guard.ts
│   │   ├── middleware/
│   │   │   └── aes-decrypt.middleware.ts  ← AES-256-GCM decryption
│   │   ├── filters/
│   │   │   └── http-exception.filter.ts
│   │   └── interceptors/
│   │       └── transform.interceptor.ts   ← wrap { data, meta }
│   ├── prisma/
│   │   └── prisma.service.ts
│   ├── jobs/
│   │   ├── push.processor.ts
│   │   └── payout.processor.ts
│   └── modules/
│       ├── auth/
│       │   ├── auth.module.ts
│       │   ├── auth.controller.ts
│       │   ├── auth.service.ts
│       │   ├── strategies/
│       │   │   ├── jwt.strategy.ts
│       │   │   └── google.strategy.ts
│       │   └── dto/
│       │       ├── register.dto.ts
│       │       ├── login.dto.ts
│       │       ├── verify-otp.dto.ts
│       │       ├── refresh-token.dto.ts
│       │       ├── forgot-password.dto.ts
│       │       └── reset-password.dto.ts
│       ├── users/
│       │   ├── users.module.ts
│       │   ├── users.controller.ts
│       │   ├── users.service.ts
│       │   ├── schemas/
│       │   │   └── journal-entry.schema.ts
│       │   └── dto/
│       │       ├── update-profile.dto.ts
│       │       ├── add-favorite.dto.ts
│       │       └── add-journal.dto.ts
│       ├── scan/
│       │   ├── scan.module.ts
│       │   ├── scan.controller.ts
│       │   ├── scan.service.ts
│       │   ├── schemas/
│       │   │   └── scan-result.schema.ts
│       │   └── dto/
│       │       └── scan-text.dto.ts
│       ├── restaurants/
│       │   ├── restaurants.module.ts
│       │   ├── restaurants.controller.ts
│       │   ├── restaurants.service.ts
│       │   └── dto/
│       │       ├── search-restaurants.dto.ts
│       │       └── create-review.dto.ts
│       ├── orders/
│       │   ├── orders.module.ts
│       │   ├── orders.controller.ts
│       │   ├── orders.service.ts
│       │   ├── orders.gateway.ts          ← Socket.io WebSocket
│       │   └── dto/
│       │       └── create-order.dto.ts
│       ├── payments/
│       │   ├── payments.module.ts
│       │   ├── payments.controller.ts
│       │   ├── payments.service.ts
│       │   └── dto/
│       │       ├── initiate-payment.dto.ts
│       │       └── topup-wallet.dto.ts
│       ├── events/
│       │   ├── events.module.ts
│       │   ├── events.controller.ts
│       │   ├── events.service.ts
│       │   ├── events.gateway.ts          ← Socket.io live events
│       │   └── dto/
│       │       └── create-event.dto.ts
│       ├── courses/
│       │   ├── courses.module.ts
│       │   ├── courses.controller.ts
│       │   ├── courses.service.ts
│       │   └── dto/
│       │       └── create-course.dto.ts
│       ├── games/
│       │   ├── games.module.ts
│       │   ├── games.controller.ts
│       │   ├── games.service.ts
│       │   └── dto/
│       │       ├── submit-quiz.dto.ts
│       │       └── buy-ticket.dto.ts
│       ├── community/
│       │   ├── community.module.ts
│       │   ├── community.controller.ts
│       │   ├── community.service.ts
│       │   ├── schemas/
│       │   │   ├── post.schema.ts
│       │   │   └── story.schema.ts
│       │   └── dto/
│       │       ├── create-post.dto.ts
│       │       └── create-thread.dto.ts
│       ├── admin/
│       │   ├── admin.module.ts
│       │   ├── admin.controller.ts
│       │   ├── admin.service.ts
│       │   ├── admin.resolver.ts          ← GraphQL resolver
│       │   └── dto/
│       │       ├── push-notification.dto.ts
│       │       └── update-settings.dto.ts
│       └── pro/
│           ├── pro.module.ts
│           ├── pro.controller.ts
│           ├── pro.service.ts
│           ├── pro.resolver.ts            ← GraphQL resolver
│           └── dto/
│               ├── upgrade-pro.dto.ts
│               └── create-promo.dto.ts
```

---

## ORDER OF GENERATION

Generate files in this exact order so dependencies are always defined before use:

1. `package.json`
2. `tsconfig.json` + `tsconfig.build.json` + `nest-cli.json`
3. `docker-compose.yml` + `Dockerfile`
4. `.env.example`
5. `prisma/schema.prisma` — COMPLETE, all models
6. `prisma/seed.ts`
7. `src/prisma/prisma.service.ts`
8. `src/config/config.module.ts`
9. `src/common/**` — all guards, middleware, decorators, filters, interceptors
10. `src/jobs/**`
11. Each module in order: auth → users → scan → restaurants → orders → payments → events → courses → games → community → pro → admin
    For each module: dto/ → schemas/ → service → controller → gateway/resolver → module
12. `src/app.module.ts`
13. `src/main.ts`
14. `README.md`

---

## INSTRUCTIONS ABSOLUES

- Génère le code COMPLET de chaque fichier, sans aucune omission
- Zéro `any` TypeScript — tous les types explicites
- Chaque DTO utilise `class-validator` decorators
- Chaque endpoint est documenté avec `@ApiOperation`, `@ApiResponse` Swagger
- AES-256-GCM middleware appliqué UNIQUEMENT sur: POST /scan/image, POST /scan/audio, POST /scan/text, POST /payments/initiate
- Le PrismaService s'étend de PrismaClient avec `enableShutdownHooks`
- Utilise `crypto` (Node.js built-in) pour AES — PAS `node-forge` directement dans le middleware
- Les réponses sont wrappées par `TransformInterceptor` : `{ data: T, meta?: { page, total } }`
- JWT guard est global (APP_GUARD) sauf routes marquées `@Public()`
- Génère un `@Public()` decorator pour les routes sans auth (register, login, webhooks)
