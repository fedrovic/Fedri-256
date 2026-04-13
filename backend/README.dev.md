# Development & Test Setup (Backend)

Prerequisites
- Node.js 20+ installed
- npm (bundled with Node)
- Docker (for running Postgres/Redis locally) or local Postgres/Redis instances

Quick start (uses Docker Compose)

```powershell
cd backend
npm ci
docker compose up -d postgres redis
npm run db:reset    # runs migrations and seeds
npm test
```

If you prefer GitHub Actions to run tests, push your branch and the workflow in `.github/workflows/ci.yml` will run automatically.

Notes
- Tests previously used `--forceExit`; that flag was removed to expose hanging async issues.
- If tests hang, run `npm run test:watch` and inspect open handles.
- For Windows, avoid mounting host `node_modules` into containers; use named volumes or run tests outside containers.
