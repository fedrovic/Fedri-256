# SkillSwap Backend API

> Node.js + Express REST API for the SkillSwap peer-to-peer skill exchange platform.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 20 (LTS) |
| Framework | Express 4 |
| Database | PostgreSQL 16 via Prisma ORM |
| Cache / Queue | Redis 7 via ioredis |
| Authentication | JWT (access + refresh tokens), Argon2id hashing |
| OAuth | Google, GitHub via Passport.js |
| Real-time | Socket.IO 4 (WebSocket) |
| Validation | Zod |
| Email | Nodemailer + SendGrid |
| Payments | Stripe |
| File Storage | Cloudflare R2 (S3-compatible) |
| 2FA | TOTP via speakeasy |
| Logging | Winston + Daily Rotate |
| Testing | Jest + Supertest |
| Containerisation | Docker + Docker Compose |

---

## Project Structure

```
skillswap-backend/
├── src/
│   ├── server.js              # Entry point — bootstrap
│   ├── app.js                 # Express app + middleware
│   ├── config/
│   │   ├── database.js        # Prisma client
│   │   ├── redis.js           # ioredis client
│   │   ├── logger.js          # Winston logger
│   │   ├── passport.js        # OAuth strategies
│   │   └── constants.js       # App-wide constants
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── swap.controller.js
│   │   ├── session.controller.js
│   │   ├── message.controller.js
│   │   ├── review.controller.js
│   │   ├── search.controller.js
│   │   ├── coin.controller.js
│   │   ├── notification.controller.js
│   │   └── admin.controller.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── swap.routes.js
│   │   ├── session.routes.js
│   │   ├── message.routes.js
│   │   ├── review.routes.js
│   │   ├── search.routes.js
│   │   ├── coin.routes.js
│   │   ├── notification.routes.js
│   │   ├── admin.routes.js
│   │   └── webhook.routes.js
│   ├── middleware/
│   │   ├── auth.js            # JWT + role guard
│   │   ├── errorHandler.js    # Global error handler
│   │   ├── rateLimiter.js     # API + auth rate limits
│   │   ├── validate.js        # Zod request validation
│   │   ├── requestId.js       # X-Request-ID header
│   │   └── notFound.js        # 404 handler
│   ├── services/
│   │   ├── email.service.js
│   │   ├── notification.service.js
│   │   ├── badge.service.js
│   │   ├── coin.service.js
│   │   ├── search.service.js
│   │   ├── storage.service.js
│   │   └── stripe.service.js
│   ├── sockets/
│   │   └── index.js           # Socket.IO — messaging + presence
│   ├── jobs/
│   │   └── index.js           # Background jobs (reminders, expiry)
│   ├── validators/
│   │   ├── auth.validator.js
│   │   ├── swap.validator.js
│   │   ├── session.validator.js
│   │   └── user.validator.js
│   └── utils/
│       ├── ApiError.js
│       ├── jwt.js
│       ├── cookies.js
│       └── otp.js
├── prisma/
│   ├── schema.prisma          # Complete DB schema
│   └── seed.js                # Development seed data
├── tests/
│   ├── integration/
│   │   └── auth.test.js
│   └── unit/
│       └── jwt.test.js
├── .env.example
├── docker-compose.yml
├── Dockerfile
└── package.json
```

---

## Quick Start

### Prerequisites
- Node.js 20+
- Docker & Docker Compose (recommended)
- Or: PostgreSQL 16 + Redis 7 installed locally

### 1. Clone and install

```bash
git clone https://github.com/your-org/skillswap-backend.git
cd skillswap-backend
npm install
```

### 2. Environment

```bash
cp .env.example .env
# Fill in all required values (database, JWT secrets, OAuth keys, etc.)
```

### 3. Start infrastructure (Docker)

```bash
docker-compose up postgres redis -d
```

### 4. Database setup

```bash
# Run migrations
npm run db:migrate

# Seed development data
npm run db:seed

# Open Prisma Studio (optional)
npm run db:studio
```

### 5. Start the server

```bash
# Development (hot reload)
npm run dev

# Production
npm start
```

Server starts at `http://localhost:4000`
Health check: `GET /health`

---

## API Reference

### Base URL
```
http://localhost:4000/api/v1
```

### Authentication
All protected routes require:
```
Authorization: Bearer <access_token>
```

Access tokens expire in 15 minutes. Use `POST /auth/refresh-token` to rotate.

---

### Endpoints

#### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | ❌ | Register with email + password |
| POST | `/auth/login` | ❌ | Login, receive tokens |
| POST | `/auth/logout` | ✅ | Revoke refresh token |
| POST | `/auth/refresh-token` | ❌ | Rotate token pair |
| POST | `/auth/verify-email` | ❌ | Verify email with OTP |
| POST | `/auth/forgot-password` | ❌ | Request reset OTP |
| POST | `/auth/reset-password` | ❌ | Reset with OTP |
| POST | `/auth/2fa/setup` | ✅ | Get TOTP secret + QR |
| POST | `/auth/2fa/confirm` | ✅ | Confirm and enable 2FA |
| POST | `/auth/2fa/verify` | ❌ | Verify 2FA code at login |
| GET | `/auth/google` | ❌ | Google OAuth redirect |
| GET | `/auth/github` | ❌ | GitHub OAuth redirect |

#### Users
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users/me` | ✅ | Get current user profile |
| PATCH | `/users/me` | ✅ | Update profile |
| DELETE | `/users/me` | ✅ | Delete account (GDPR) |
| GET | `/users/:id` | ❌ | Get public profile |
| POST | `/users/:id/favourite` | ✅ | Favourite a profile |
| DELETE | `/users/:id/favourite` | ✅ | Unfavourite |
| GET | `/users/me/coins/history` | ✅ | SkillCoin transaction history |
| GET | `/users/me/badges` | ✅ | Badges earned |
| POST | `/users/me/skills` | ✅ | Add skill |
| PUT | `/users/me/skills/:id` | ✅ | Update skill |
| DELETE | `/users/me/skills/:id` | ✅ | Remove skill |
| PUT | `/users/me/availability` | ✅ | Set availability |
| GET | `/users/me/data-export` | ✅ | GDPR data export |

#### Swaps
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/swaps` | ✅ | Create swap request |
| GET | `/swaps` | ✅ | List my swaps (filter by status) |
| GET | `/swaps/:id` | ✅ | Get swap details |
| PATCH | `/swaps/:id/accept` | ✅ | Accept incoming request |
| PATCH | `/swaps/:id/decline` | ✅ | Decline request |
| PATCH | `/swaps/:id/counter` | ✅ | Counter-propose terms |
| PATCH | `/swaps/:id/pause` | ✅ | Pause active swap |
| PATCH | `/swaps/:id/resume` | ✅ | Resume paused swap |
| PATCH | `/swaps/:id/cancel` | ✅ | Cancel swap |
| PATCH | `/swaps/:id/complete` | ✅ | Mark as complete |
| POST | `/swaps/:id/dispute` | ✅ | Open dispute |

#### Sessions
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/sessions` | ✅ | Schedule session |
| GET | `/sessions` | ✅ | List my sessions |
| GET | `/sessions/:id` | ✅ | Get session details |
| PATCH | `/sessions/:id/confirm` | ✅ | Confirm proposed time |
| PATCH | `/sessions/:id/reschedule` | ✅ | Propose new time |
| PATCH | `/sessions/:id/complete` | ✅ | Mark session completed |
| PATCH | `/sessions/:id/cancel` | ✅ | Cancel session |
| POST | `/sessions/:id/flag` | ✅ | Flag quality issue |

#### Messages
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/messages/swaps/:swapId` | ✅ | Get message history |
| POST | `/messages/swaps/:swapId` | ✅ | Send message (REST fallback) |
| PATCH | `/messages/:id` | ✅ | Edit message |
| DELETE | `/messages/:id` | ✅ | Delete message |
| POST | `/messages/:id/react` | ✅ | Add/remove reaction |

#### Reviews
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/reviews` | ✅ | Submit review |
| GET | `/reviews/user/:userId` | ❌ | Get user's reviews |
| PATCH | `/reviews/:id/respond` | ✅ | Respond to review |
| POST | `/reviews/:id/report` | ✅ | Report a review |

#### Search
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/search/users` | ✅ | Search + filter users |
| GET | `/search/skills` | ❌ | Search skills |
| GET | `/search/recommendations` | ✅ | Personalised match feed |

#### Notifications
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/notifications` | ✅ | Get notifications |
| PATCH | `/notifications/:id/read` | ✅ | Mark as read |
| PATCH | `/notifications/read-all` | ✅ | Mark all read |
| PUT | `/notifications/preferences` | ✅ | Update preferences |

#### Webhooks
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/webhooks/stripe` | Stripe sig | Handle Stripe events |

---

## WebSocket Events

Connect to `ws://localhost:4000` with auth token:
```js
const socket = io('http://localhost:4000', {
  auth: { token: accessToken }
});
```

### Client → Server
| Event | Payload | Description |
|---|---|---|
| `join:swap` | `{ swapId }` | Join swap message room |
| `leave:swap` | `{ swapId }` | Leave room |
| `message:send` | `{ swapId, content, type }` | Send message |
| `message:read` | `{ swapId, messageId }` | Mark as read |
| `typing:start` | `{ swapId }` | Show typing indicator |
| `typing:stop` | `{ swapId }` | Hide typing indicator |
| `message:react` | `{ messageId, emoji, swapId }` | Add/remove reaction |
| `call:invite` | `{ swapId, targetUserId }` | Initiate video call |
| `call:accept` | `{ swapId, callerId }` | Accept call |
| `call:reject` | `{ swapId, callerId }` | Decline call |
| `webrtc:offer` | `{ targetId, offer }` | WebRTC offer |
| `webrtc:answer` | `{ targetId, answer }` | WebRTC answer |
| `webrtc:ice` | `{ targetId, candidate }` | ICE candidate |

### Server → Client
| Event | Payload | Description |
|---|---|---|
| `message:new` | `{ message }` | New message received |
| `message:read_receipt` | `{ messageId, readBy }` | Message read |
| `typing:indicator` | `{ userId, isTyping }` | Partner typing |
| `message:reaction_added` | `{ messageId, userId, emoji }` | Reaction added |
| `swap:new_request` | `{ swap }` | New swap request |
| `swap:accepted` | `{ swapId }` | Swap accepted |
| `swap:declined` | `{ swapId, reason }` | Swap declined |
| `swap:paused` | `{ swapId }` | Swap paused |
| `swap:resumed` | `{ swapId }` | Swap resumed |
| `notification:new` | `{ notification }` | Push notification |
| `user:online_status` | `{ userId, isOnline }` | Partner online/offline |
| `call:incoming` | `{ swapId, callerId }` | Incoming call |

---

## Testing

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Coverage report
npm run test:coverage
```

Coverage target: ≥ 80% lines/statements

---

## Security

- Passwords: Argon2id (memoryCost 64MB, timeCost 3)
- Tokens: JWT RS256 (access 15min, refresh 30d, HTTP-only cookie)
- Rate limiting: 100 req/min (API), 20 req/15min (auth)
- Account lockout: 5 failed logins → 15min lockout
- Input validation: Zod on every route
- OWASP headers: helmet.js
- SQL injection: Prisma parameterised queries (impossible to inject)
- CORS: strict allowlist
- 2FA: TOTP (RFC 6238)
- PII: column-level encryption (production)

---

## Deployment

### Environment variables required in production
See `.env.example` — all values with no defaults must be set.

### Database migrations
```bash
# Apply migrations without reset
npm run db:migrate:prod
```

### Health monitoring
- `GET /health` — returns 200 OK with status JSON
- Prometheus metrics at `/metrics` (production)
- Sentry DSN: set `SENTRY_DSN` env var

---

## License
MIT — SkillSwap 2026
