# LifeOS

A minimalist, modern personal finance and life management dashboard — built as a Progressive Web App (PWA) optimized for iOS Safari.

## Features

- **Dashboard** — Net worth overview, account balances, recent transactions, goal progress, investment snapshot
- **Bank Accounts** — Track all bank accounts, wallets, credit cards with real-time balance
- **Expense Tracking** — Manual entry + auto-sync from Gmail via AI categorization (Google Gemini)
- **Investment Tracking** — Real-time stock/ETF/crypto quotes via Yahoo Finance, portfolio allocation charts
- **Offline Assets** — Track real estate, gold, private equity with appreciation rates
- **Committee/Chit Fund** — Payment grid tracking, payout cycle visualization, net benefit calculation
- **Goal Planning** — Target amounts, deadlines, progress rings, monthly savings calculator
- **Budget Planning** — Per-category monthly budgets with over-budget alerts
- **Net Worth Dashboard** — Assets vs liabilities, loan amortization, cash flow summary
- **Analytics** — Category breakdowns, income vs expense trends, savings rate tracking
- **Notifications** — Bill reminders, investment alerts, committee payment dues
- **Security** — Email/password auth, Face ID / biometric via WebAuthn, encrypted data storage


## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Database:** PostgreSQL via Neon (serverless)
- **ORM:** Prisma v7
- **Auth:** NextAuth v5 + WebAuthn
- **AI:** Google Gemini 2.0 Flash (free)
- **Market Data:** yahoo-finance2
- **Styling:** Tailwind CSS v4, Framer Motion
- **Charts:** Recharts
- **PWA:** @ducanh2912/next-pwa
- **Deployment:** Vercel + Neon PostgreSQL

## Getting Started

### Prerequisites

- Node.js 18+
- A Neon PostgreSQL database (free tier: [neon.tech](https://neon.tech))
- Google Gemini API key (free: [aistudio.google.com](https://aistudio.google.com/apikey))

### Setup

1. Clone and install dependencies:

```bash
npm install
```

2. Copy the environment file and fill in your values:

```bash
cp .env.example .env
```

3. Set up the database:

```bash
npx prisma migrate dev --name init
```

4. Generate the Prisma client:

```bash
npx prisma generate
```

5. Run the development server:

```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) and create an account.

### Environment Variables

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random 32-character secret for JWT |
| `NEXTAUTH_URL` | Your app URL (http://localhost:3000 for dev) |
| `GEMINI_API_KEY` | Google Gemini API key (free from AI Studio) |
| `GOOGLE_CLIENT_ID` | Gmail OAuth client ID (for email sync) |
| `GOOGLE_CLIENT_SECRET` | Gmail OAuth client secret |
| `ENCRYPTION_KEY` | 64-character hex key for AES-256 encryption |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token (for document uploads) |
| `WEBAUTHN_RP_ID` | Relying Party ID (your domain) |
| `WEBAUTHN_RP_NAME` | Display name for WebAuthn (LifeOS) |
| `CRON_SECRET` | Secret for authenticating cron job requests |

### Deploy to Vercel

1. Push to GitHub
2. Import in Vercel
3. Add environment variables
4. Deploy

Vercel cron jobs (configured in `vercel.json`) will automatically:
- Sync emails every 6 hours
- Refresh investment prices at market open/close (weekdays)

## Project Structure

```
src/
├── app/
│   ├── (auth)/          Login, signup pages
│   ├── (app)/           Dashboard, accounts, expenses, investments, etc.
│   └── api/             REST API routes + cron jobs
├── components/
│   ├── ui/              Reusable primitives (Button, Card, Modal, etc.)
│   ├── layout/          App shell, bottom nav, header
│   ├── charts/          Donut, line, bar charts + progress ring
│   └── features/        Feature-specific components
├── lib/                 Prisma, auth, Gemini AI, Yahoo Finance, encryption
├── hooks/               React hooks (auth, biometric)
└── types/               TypeScript types and constants
```

## License

MIT
