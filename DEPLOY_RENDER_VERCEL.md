# Deploy SkillSwap (Backend on Render, Frontend on Vercel)

This guide is for this repository structure:
- backend on Render (Node web service)
- frontend on Vercel (static hosting)

## 1) Deploy Backend to Render

1. In Render, click New +, then Web Service.
2. Connect your GitHub repo.
3. Set Root Directory to backend.
4. Use these service settings:
   - Runtime: Node
   - Build Command: npm ci && npx prisma generate
   - Start Command: npx prisma db push && node src/server.js
   - Health Check Path: /health

Why db push is used:
- This repo currently has schema.prisma but no prisma/migrations folder.
- prisma migrate deploy will fail without migration files.

## 2) Create Database and Redis on Render

You need both for this backend to start.

1. Create a PostgreSQL instance in Render.
2. Create a Redis instance in Render.
3. In backend environment variables, set:
   - DATABASE_URL = your Render Postgres connection string
   - REDIS_URL = your Render Redis internal connection string

If REDIS_URL is missing or wrong, backend bootstrap will fail.

## 3) Required Backend Environment Variables

Set these in Render for the backend service:

Core:
- NODE_ENV=production
- PORT=10000 (optional; Render sets PORT automatically)
- API_VERSION=v1

CORS and frontend redirect:
- FRONTEND_URL=https://your-vercel-domain.vercel.app
- ALLOWED_ORIGINS=https://your-vercel-domain.vercel.app

Auth:
- JWT_ACCESS_SECRET=long-random-secret
- JWT_REFRESH_SECRET=another-long-random-secret
- JWT_ACCESS_EXPIRES=15m
- JWT_REFRESH_EXPIRES=30d

Database and cache:
- DATABASE_URL=...
- REDIS_URL=...

Optional features (set only if used):
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_CALLBACK_URL=https://your-render-service.onrender.com/api/v1/auth/google/callback
- SENDGRID_API_KEY
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- R2_ACCOUNT_ID and related R2 vars

## 4) Verify Backend First

After deploy, open:
- https://your-render-service.onrender.com/health

Expected response: JSON with status ok.

Do not deploy frontend until this works.

## 5) Deploy Frontend to Vercel

1. In Vercel, import the same GitHub repository.
2. Keep project root at repository root (not backend).
3. Vercel should use existing config in vercel.json.
4. Deploy.

This repo uses:
- root package.json build script to copy frontend to public
- vercel.json static build with distDir public

## 6) Connect Frontend to Backend

You have 2 valid options.

Option A (recommended): keep frontend using /api/v1 and add Vercel rewrite to Render.
- Edit vercel.json and add rewrite before catch-all rule:
  - source: /api/v1/:path*
  - destination: https://your-render-service.onrender.com/api/v1/:path*

Option B: set a global API base URL in frontend pages:
- Before loading skillswap-api.js, set:
  window.SKILLSWAP_API_BASE_URL = 'https://your-render-service.onrender.com/api/v1';

If you do Option A, no frontend code changes per page are needed.

## 7) Typical Failure Reasons in This Repo

1. Render service root directory not set to backend.
2. No database or Redis configured.
3. Using prisma migrate deploy even though migrations folder is missing.
4. CORS not including your Vercel domain in ALLOWED_ORIGINS.
5. Frontend still calling wrong API origin.
6. OAuth callback URL still pointing to localhost.

## 8) Quick Smoke Test

After both are live:

1. Open frontend URL.
2. Open browser DevTools Network tab.
3. Trigger login/register request.
4. Confirm request goes to either:
   - /api/v1/... on Vercel (if rewrite used), or
   - your Render URL (if global override used).
5. Confirm response is not blocked by CORS.

## 9) If Deploy Still Fails

Collect and share these 4 things:
- Render deploy log error line
- Render runtime log error line
- Vercel deploy error line (if any)
- Browser Network request URL + status for /api/v1/auth/login

With these, the issue can be fixed quickly.
