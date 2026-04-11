# SkillSwap — Complete Project

Peer-to-peer skill exchange platform. Trade skills, not money.

## Project Structure

```
skillswap-project/
├── frontend/                  ← 8 HTML pages + API client
│   ├── skillswap-landing.html
│   ├── skillswap-auth.html
│   ├── skillswap-onboarding.html
│   ├── skillswap-dashboard.html
│   ├── skillswap-discover.html
│   ├── skillswap-profile.html
│   ├── skillswap-swaps.html
│   ├── skillswap-messages.html
│   ├── skillswap-api.js        ← API client (connect frontend to backend)
│   └── skillswap-integration.js ← Page wiring guide
│
└── backend/                   ← Node.js REST API
    ├── src/
    │   ├── controllers/       ← 9 controllers (auth, users, swaps, sessions...)
    │   ├── routes/            ← 12 route files
    │   ├── middleware/        ← Auth, rate limiting, validation, error handling
    │   ├── services/          ← Email, notifications, badges
    │   ├── sockets/           ← Real-time messaging via Socket.IO
    │   ├── jobs/              ← Background jobs (reminders, expiry, cleanup)
    │   ├── config/            ← DB, Redis, Passport, constants
    │   └── utils/             ← JWT, OTP, cookies, logger, error classes
    ├── prisma/
    │   ├── schema.prisma      ← Full database schema (12 models)
    │   └── seed.js            ← Seed categories, skills, test users
    ├── tests/                 ← Integration + unit tests (Jest)
    ├── .env.example           ← Copy to .env and fill in values
    ├── docker-compose.yml     ← Spin up full stack locally
    ├── Dockerfile             ← Production multi-stage build
    └── README.md              ← Full API documentation
```

## Quick Start

### Option A — Docker (recommended)
```bash
cd backend
cp .env.example .env
docker compose up --build
# In another terminal:
docker compose exec api npx prisma migrate dev
docker compose exec api node prisma/seed.js
```
Then open `frontend/skillswap-landing.html` in your browser.

### Option B — Manual
```bash
cd backend
npm install
cp .env.example .env        # Fill in DATABASE_URL, REDIS_URL, JWT secrets
npx prisma migrate dev
node prisma/seed.js
npm run dev
```

## Test Accounts (after seeding)
| Email | Password |
|-------|----------|
| john.doe@test.skillswap.io | Test1234! |
| maria.kovac@test.skillswap.io | Test1234! |
| sara.lindqvist@test.skillswap.io | Test1234! |

## API
Base URL: `http://localhost:5000/api/v1`
Health check: `http://localhost:5000/health`

See `backend/README.md` for full API documentation (55+ endpoints).

## Tech Stack
- **Frontend**: Vanilla HTML/CSS/JS, responsive, PWA-ready
- **Backend**: Node.js, Express, Prisma, PostgreSQL, Redis, Socket.IO
- **Auth**: JWT + Google OAuth + 2FA (TOTP)
- **Payments**: Stripe (Premium subscriptions + SkillCoins)
- **Email**: SendGrid
- **Storage**: Cloudflare R2
- **CI/CD**: GitHub Actions (7-stage pipeline)
- **Containers**: Docker + Docker Compose
