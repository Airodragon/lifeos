# AGENTS.md

## Cursor Cloud specific instructions

### Overview

LifeOS is a personal finance dashboard built with Next.js 16, Prisma v7, and PostgreSQL (Neon serverless). See `README.md` for the full tech stack and project structure.

### Local Database Setup

The app uses `@prisma/adapter-neon` which requires a WebSocket proxy to connect to local PostgreSQL. A Go-based `wsproxy` (from `github.com/neondatabase/wsproxy`) must be running on port 5433 before starting the dev server.

**Start PostgreSQL and wsproxy:**
```bash
sudo pg_ctlcluster 16 main start
LISTEN_PORT=:5433 ALLOW_ADDR_REGEX='.*' /usr/local/bin/wsproxy &
```

The `NEON_LOCAL=true` env var in `.env` triggers `src/lib/prisma.ts` to route connections through the local wsproxy. Without this, database queries will fail with WebSocket errors.

### Running the App

Standard commands are in `package.json` scripts:
- `npm run dev` — dev server on port 3000
- `npm run build` — production build
- `npm run lint` — ESLint (pre-existing warnings/errors exist)
- `npm run db:push` — push Prisma schema to database
- `npm run db:seed` — seed admin user (requires `--import ./scripts/neon-local-config.ts` with tsx)

**Seeding with local PostgreSQL:**
```bash
npx tsx --import ./scripts/neon-local-config.ts prisma/seed.ts
```

### Environment Variables

Copy `.env.example` to `.env` and set required values. Key ones for local dev:
- `DATABASE_URL` — local PostgreSQL connection string
- `NEON_LOCAL` — set to `"true"` for local wsproxy routing
- `NEXTAUTH_SECRET`, `ENCRYPTION_KEY` — generate random values
- `SEED_EMAIL`, `SEED_PASSWORD`, `SEED_NAME` — for database seeding

### Test Credentials

After seeding: `admin@lifeos.app` / `admin123` (or whatever `SEED_EMAIL`/`SEED_PASSWORD` are set to).

### Gotchas

- The Neon adapter requires wsproxy even for local PostgreSQL — plain TCP connections won't work.
- The `instrumentation.ts` file exists but may not reliably execute with Turbopack in Next.js 16; the neonConfig is applied directly in `src/lib/prisma.ts` instead.
- Lint has ~16 pre-existing errors (React Hook `set-state-in-effect` rules) and ~30 warnings — these are not regressions.
- Optional API keys (Gemini AI, Google OAuth, VAPID push) can be left empty; those features degrade gracefully.
