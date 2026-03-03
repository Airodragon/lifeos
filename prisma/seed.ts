import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import { hash } from "bcryptjs";
import "dotenv/config";

const EMAIL = process.env.SEED_EMAIL || "admin@lifeos.app";
const PASSWORD = process.env.SEED_PASSWORD || "changeme123";
const NAME = process.env.SEED_NAME || "Me";

// ─── helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(10, 0, 0, 0);
  return d;
}

function monthsAgo(n: number) {
  const d = new Date();
  d.setMonth(d.getMonth() - n, 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  neonConfig.webSocketConstructor = ws;
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  // ── 1. User ────────────────────────────────────────────────────────────────
  let user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (user) {
    console.log(`ℹ️  User "${EMAIL}" already exists — skipping user creation, seeding remaining data.`);
  } else {
    const passwordHash = await hash(PASSWORD, 12);
    user = await prisma.user.create({
      data: { email: EMAIL, passwordHash, name: NAME, onboarded: true },
    });
    console.log(`✅ Created user: ${EMAIL} / ${PASSWORD}`);
  }

  const uid = user.id;

  // ── 2. Categories ──────────────────────────────────────────────────────────
  const catDefs = [
    { name: "Food & Dining", icon: "UtensilsCrossed", color: "#f97316", type: "expense" },
    { name: "Groceries", icon: "ShoppingCart", color: "#84cc16", type: "expense" },
    { name: "Transport", icon: "Car", color: "#3b82f6", type: "expense" },
    { name: "Shopping", icon: "ShoppingBag", color: "#ec4899", type: "expense" },
    { name: "Entertainment", icon: "Tv", color: "#8b5cf6", type: "expense" },
    { name: "Bills & Utilities", icon: "Zap", color: "#eab308", type: "expense" },
    { name: "Health & Medical", icon: "Heart", color: "#ef4444", type: "expense" },
    { name: "Education", icon: "GraduationCap", color: "#06b6d4", type: "expense" },
    { name: "Travel", icon: "Plane", color: "#14b8a6", type: "expense" },
    { name: "Rent & Housing", icon: "Home", color: "#6366f1", type: "expense" },
    { name: "Subscriptions", icon: "CreditCard", color: "#a855f7", type: "expense" },
    { name: "Personal Care", icon: "Sparkles", color: "#f472b6", type: "expense" },
    { name: "Fuel", icon: "Fuel", color: "#fb923c", type: "expense" },
    { name: "Other Expense", icon: "MoreHorizontal", color: "#6b7280", type: "expense" },
    { name: "Salary", icon: "Briefcase", color: "#0ea5e9", type: "income" },
    { name: "Freelance", icon: "Laptop", color: "#22c55e", type: "income" },
    { name: "Investment Return", icon: "TrendingUp", color: "#10b981", type: "income" },
    { name: "Other Income", icon: "Wallet", color: "#64748b", type: "income" },
  ];

  const cats: Record<string, string> = {};
  for (const c of catDefs) {
    const existing = await prisma.category.findFirst({ where: { userId: uid, name: c.name } });
    if (existing) {
      cats[c.name] = existing.id;
    } else {
      const created = await prisma.category.create({ data: { ...c, userId: uid } });
      cats[c.name] = created.id;
    }
  }
  console.log(`✅ Categories ready (${Object.keys(cats).length})`);

  // ── 3. Accounts ────────────────────────────────────────────────────────────
  const accountDefs = [
    { name: "HDFC Savings", type: "savings", balance: 85000, currency: "INR" },
    { name: "ICICI Current", type: "current", balance: 32000, currency: "INR" },
    { name: "SBI Digital", type: "savings", balance: 12500, currency: "INR" },
    { name: "HDFC Credit Card", type: "credit_card", balance: -18500, currency: "INR", creditLimit: 200000 },
    { name: "Cash Wallet", type: "cash", balance: 3000, currency: "INR" },
  ];

  const accounts: Record<string, string> = {};
  for (const a of accountDefs) {
    const existing = await prisma.account.findFirst({ where: { userId: uid, name: a.name } });
    if (existing) {
      accounts[a.name] = existing.id;
    } else {
      const created = await prisma.account.create({ data: { userId: uid, ...a } });
      accounts[a.name] = created.id;
    }
  }
  console.log(`✅ Accounts ready (${Object.keys(accounts).length})`);

  // ── 4. Transactions — 3 months of realistic data ───────────────────────────
  const txnDefs = [
    // This month
    { desc: "Bigbasket groceries", type: "expense", amount: 3200, cat: "Groceries", acc: "HDFC Savings", da: 2 },
    { desc: "Zomato dinner", type: "expense", amount: 680, cat: "Food & Dining", acc: "HDFC Credit Card", da: 3 },
    { desc: "Uber ride", type: "expense", amount: 240, cat: "Transport", acc: "HDFC Credit Card", da: 5 },
    { desc: "Netflix", type: "expense", amount: 649, cat: "Subscriptions", acc: "HDFC Credit Card", da: 6 },
    { desc: "Electricity bill", type: "expense", amount: 1850, cat: "Bills & Utilities", acc: "HDFC Savings", da: 7 },
    { desc: "Salary — March", type: "income", amount: 95000, cat: "Salary", acc: "HDFC Savings", da: 1 },
    { desc: "Swiggy lunch", type: "expense", amount: 380, cat: "Food & Dining", acc: "HDFC Credit Card", da: 4 },
    { desc: "Petrol", type: "expense", amount: 1500, cat: "Fuel", acc: "Cash Wallet", da: 8 },
    { desc: "Apollo pharmacy", type: "expense", amount: 920, cat: "Health & Medical", acc: "HDFC Credit Card", da: 9 },
    { desc: "Amazon order", type: "expense", amount: 2400, cat: "Shopping", acc: "HDFC Credit Card", da: 10 },
    // Last month
    { desc: "Bigbasket groceries", type: "expense", amount: 2900, cat: "Groceries", acc: "HDFC Savings", da: 35 },
    { desc: "Restaurant dinner", type: "expense", amount: 1200, cat: "Food & Dining", acc: "HDFC Credit Card", da: 36 },
    { desc: "Salary — February", type: "income", amount: 95000, cat: "Salary", acc: "HDFC Savings", da: 31 },
    { desc: "Internet broadband", type: "expense", amount: 999, cat: "Bills & Utilities", acc: "HDFC Savings", da: 40 },
    { desc: "Gym membership", type: "expense", amount: 2500, cat: "Health & Medical", acc: "HDFC Savings", da: 42 },
    { desc: "Mobile recharge", type: "expense", amount: 349, cat: "Bills & Utilities", acc: "HDFC Savings", da: 38 },
    { desc: "Freelance UI project", type: "income", amount: 25000, cat: "Freelance", acc: "HDFC Savings", da: 45 },
    { desc: "Myntra clothes", type: "expense", amount: 3600, cat: "Shopping", acc: "HDFC Credit Card", da: 50 },
    { desc: "Petrol", type: "expense", amount: 1500, cat: "Fuel", acc: "Cash Wallet", da: 55 },
    // 2 months ago
    { desc: "Salary — January", type: "income", amount: 95000, cat: "Salary", acc: "HDFC Savings", da: 62 },
    { desc: "Rent", type: "expense", amount: 22000, cat: "Rent & Housing", acc: "HDFC Savings", da: 63 },
    { desc: "Bigbasket groceries", type: "expense", amount: 3100, cat: "Groceries", acc: "HDFC Savings", da: 65 },
    { desc: "Movie + dinner", type: "expense", amount: 1800, cat: "Entertainment", acc: "HDFC Credit Card", da: 70 },
    { desc: "Car service", type: "expense", amount: 6500, cat: "Transport", acc: "HDFC Savings", da: 75 },
    { desc: "Spotify Premium", type: "expense", amount: 119, cat: "Subscriptions", acc: "HDFC Credit Card", da: 78 },
  ];

  let txnCreated = 0;
  for (const t of txnDefs) {
    const date = daysAgo(t.da);
    const existing = await prisma.transaction.findFirst({
      where: {
        userId: uid,
        description: t.desc,
        amount: t.amount,
        date: { gte: new Date(date.getTime() - 86400000), lte: new Date(date.getTime() + 86400000) },
      },
    });
    if (!existing) {
      await prisma.transaction.create({
        data: {
          userId: uid,
          amount: t.amount,
          type: t.type as "income" | "expense" | "transfer",
          description: t.desc,
          date,
          categoryId: cats[t.cat],
          accountId: accounts[t.acc],
          source: "manual",
          tags: [],
        },
      });
      txnCreated++;
    }
  }
  console.log(`✅ Transactions: ${txnCreated} created`);

  // ── 5. Subscriptions ───────────────────────────────────────────────────────
  const subDefs = [
    { name: "Netflix", amount: 649, cadence: "monthly", nextDueDate: daysAgo(-5) },
    { name: "Spotify Premium", amount: 119, cadence: "monthly", nextDueDate: daysAgo(-8) },
    { name: "Amazon Prime", amount: 1499, cadence: "yearly", nextDueDate: daysAgo(-120) },
    { name: "ChatGPT Plus", amount: 1700, cadence: "monthly", nextDueDate: daysAgo(-3) },
    { name: "GitHub Copilot", amount: 835, cadence: "monthly", nextDueDate: daysAgo(-10) },
  ];

  for (const s of subDefs) {
    const existing = await prisma.subscription.findFirst({ where: { userId: uid, name: s.name } });
    if (!existing) {
      await prisma.subscription.create({
        data: {
          userId: uid,
          name: s.name,
          amount: s.amount,
          cadence: s.cadence,
          nextDueDate: s.nextDueDate,
          active: true,
          paymentAccountId: accounts["HDFC Credit Card"],
        },
      });
    }
  }
  console.log(`✅ Subscriptions ready (${subDefs.length})`);

  // ── 6. Liabilities (Loans/EMIs) ────────────────────────────────────────────
  const liabilityDefs = [
    {
      name: "Home Loan — HDFC",
      type: "home_loan",
      principal: 4500000,
      outstanding: 3800000,
      interestRate: 8.5,
      emiAmount: 38500,
      startDate: new Date("2022-04-01"),
      endDate: new Date("2042-04-01"),
    },
    {
      name: "Car Loan — SBI",
      type: "personal_loan",
      principal: 600000,
      outstanding: 280000,
      interestRate: 9.2,
      emiAmount: 13200,
      startDate: new Date("2023-01-01"),
      endDate: new Date("2027-01-01"),
    },
  ];

  for (const l of liabilityDefs) {
    const existing = await prisma.liability.findFirst({ where: { userId: uid, name: l.name } });
    if (!existing) {
      await prisma.liability.create({ data: { userId: uid, ...l } });
    }
  }
  console.log(`✅ Liabilities ready (${liabilityDefs.length})`);

  // ── 7. Investments (Stocks/ETF) ────────────────────────────────────────────
  const investmentDefs = [
    { symbol: "RELIANCE.NS", name: "Reliance Industries", type: "stock", quantity: 10, avgBuyPrice: 2450, currentPrice: 2890 },
    { symbol: "INFY.NS", name: "Infosys Ltd", type: "stock", quantity: 25, avgBuyPrice: 1580, currentPrice: 1720 },
    { symbol: "NIFTYBEES.NS", name: "Nifty BeES ETF", type: "etf", quantity: 50, avgBuyPrice: 220, currentPrice: 265 },
    { symbol: "GOLDBEES.NS", name: "Gold BeES ETF", type: "etf", quantity: 30, avgBuyPrice: 52, currentPrice: 59 },
    { symbol: "TCS.NS", name: "Tata Consultancy Services", type: "stock", quantity: 5, avgBuyPrice: 3600, currentPrice: 3950 },
  ];

  for (const inv of investmentDefs) {
    const existing = await prisma.investment.findFirst({ where: { userId: uid, symbol: inv.symbol } });
    if (!existing) {
      await prisma.investment.create({
        data: {
          userId: uid,
          symbol: inv.symbol,
          name: inv.name,
          type: inv.type,
          quantity: inv.quantity,
          avgBuyPrice: inv.avgBuyPrice,
          currentPrice: inv.currentPrice,
        },
      });
    }
  }
  console.log(`✅ Investments ready (${investmentDefs.length})`);

  // ── 8. SIPs (Mutual Funds) ─────────────────────────────────────────────────
  const sipDefs = [
    { name: "PPFCF", fundName: "Parag Parikh Flexi Cap", schemeCode: "122639", amount: 5000, currentValue: 68000, status: "active", startDate: new Date("2023-01-05") },
    { name: "MALCF", fundName: "Mirae Asset Large Cap", schemeCode: "118989", amount: 3000, currentValue: 41000, status: "active", startDate: new Date("2023-03-05") },
    { name: "SBISCF", fundName: "SBI Small Cap Fund", schemeCode: "125497", amount: 2000, currentValue: 29500, status: "paused", startDate: new Date("2023-06-05") },
  ];

  for (const s of sipDefs) {
    const existing = await prisma.sIP.findFirst({ where: { userId: uid, fundName: s.fundName } });
    if (!existing) {
      await prisma.sIP.create({
        data: { userId: uid, name: s.name, fundName: s.fundName, schemeCode: s.schemeCode, amount: s.amount, currentValue: s.currentValue, status: s.status, sipDate: 5, startDate: s.startDate },
      });
    }
  }
  console.log(`✅ SIPs ready (${sipDefs.length})`);


  // ── 9. Fixed Deposits ─────────────────────────────────────────────────────
  const fdDefs = [
    { bankName: "SBI", principal: 100000, interestRate: 7.0, compounding: "quarterly", startDate: new Date("2025-06-01"), maturityDate: new Date("2026-06-01"), maturityAmount: 107190 },
    { bankName: "HDFC Bank", principal: 250000, interestRate: 7.25, compounding: "quarterly", startDate: new Date("2024-09-01"), maturityDate: new Date("2026-09-01"), maturityAmount: 288000 },
  ];

  for (const fd of fdDefs) {
    const existing = await prisma.fixedDeposit.findFirst({ where: { userId: uid, bankName: fd.bankName, startDate: fd.startDate } });
    if (!existing) {
      await prisma.fixedDeposit.create({ data: { userId: uid, ...fd } });
    }
  }
  console.log(`✅ Fixed Deposits ready (${fdDefs.length})`);

  // ── 10. Offline Assets ─────────────────────────────────────────────────────
  const offlineDefs = [
    { name: "24K Gold (50g)", type: "gold", purchasePrice: 240000, currentValue: 350000, purchaseDate: new Date("2021-01-01") },
    { name: "Ancestral Land — Nashik", type: "real_estate", purchasePrice: 800000, currentValue: 1800000, purchaseDate: new Date("2018-06-01") },
  ];

  for (const a of offlineDefs) {
    const existing = await prisma.offlineAsset.findFirst({ where: { userId: uid, name: a.name } });
    if (!existing) {
      await prisma.offlineAsset.create({ data: { userId: uid, ...a } });
    }
  }
  console.log(`✅ Offline Assets ready (${offlineDefs.length})`);

  // ── 11. Goals ──────────────────────────────────────────────────────────────
  const goalDefs = [
    { name: "Emergency Fund", targetAmount: 300000, currentAmount: 185000, targetDate: new Date("2026-12-31"), color: "#22c55e" },
    { name: "Europe Trip", targetAmount: 200000, currentAmount: 42000, targetDate: new Date("2027-06-01"), color: "#3b82f6" },
    { name: "New Laptop", targetAmount: 150000, currentAmount: 80000, targetDate: new Date("2026-09-01"), color: "#a855f7" },
    { name: "Retirement Corpus", targetAmount: 10000000, currentAmount: 1250000, targetDate: new Date("2045-01-01"), color: "#f97316" },
  ];

  for (const g of goalDefs) {
    const existing = await prisma.goal.findFirst({ where: { userId: uid, name: g.name } });
    if (!existing) {
      await prisma.goal.create({ data: { userId: uid, ...g } });
    }
  }
  console.log(`✅ Goals ready (${goalDefs.length})`);

  // ── 12. Budgets (current month) ────────────────────────────────────────────
  const now = new Date();
  const m = now.getMonth() + 1;
  const y = now.getFullYear();

  const budgetDefs: { cat: string; amount: number; rollover?: boolean }[] = [
    { cat: "Food & Dining", amount: 5000 },
    { cat: "Groceries", amount: 6000, rollover: true },
    { cat: "Transport", amount: 3000 },
    { cat: "Entertainment", amount: 2000 },
    { cat: "Shopping", amount: 5000 },
    { cat: "Bills & Utilities", amount: 4000, rollover: true },
    { cat: "Health & Medical", amount: 2000 },
    { cat: "Subscriptions", amount: 2500 },
  ];

  for (const b of budgetDefs) {
    if (!cats[b.cat]) continue;
    const existing = await prisma.budget.findUnique({
      where: { userId_categoryId_month_year: { userId: uid, categoryId: cats[b.cat], month: m, year: y } },
    });
    if (!existing) {
      await prisma.budget.create({
        data: { userId: uid, categoryId: cats[b.cat], amount: b.amount, month: m, year: y, rollover: b.rollover ?? false },
      });
    }
  }
  console.log(`✅ Budgets ready (${budgetDefs.length})`);

  // ── 13. Committee (Chit Fund) ──────────────────────────────────────────────
  const existingCommittee = await prisma.committee.findFirst({ where: { userId: uid } });
  if (!existingCommittee) {
    const committee = await prisma.committee.create({
      data: {
        userId: uid,
        name: "Office Chit Fund",
        payoutAmount: 10000,
        totalMembers: 10,
        startDate: monthsAgo(3),
        paymentDay: 5,
        duration: 10,
        status: "active",
      },
    });
    for (let i = 1; i <= 3; i++) {
      await prisma.committeePayment.create({
        data: { committeeId: committee.id, month: i, amount: 1000, paid: true, paidDate: monthsAgo(3 - i + 1) },
      });
    }
    console.log(`✅ Committee ready`);
  }

  // ── 14. Watchlist symbols ──────────────────────────────────────────────────
  const watchSymbols = ["NIFTY50.NS", "SENSEX.NS", "RELIANCE.NS"];
  for (const symbol of watchSymbols) {
    const existing = await prisma.watchlistItem.findFirst({ where: { userId: uid, symbol } });
    if (!existing) {
      await prisma.watchlistItem.create({ data: { userId: uid, symbol } });
    }
  }
  console.log(`✅ Watchlist ready (${watchSymbols.length})`);

  console.log(`\n🎉 Seed complete! Login: ${EMAIL} / ${PASSWORD}\n`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
