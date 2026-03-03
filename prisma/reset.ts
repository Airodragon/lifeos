/**
 * reset.ts — wipes all seed data but keeps the user account (email + password intact).
 *
 * Run:  npm run db:reset
 *
 * This deletes all transactional/financial data belonging to the user.
 * It does NOT delete the user row, so you can still log in after reset.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";
import * as readline from "readline";

const EMAIL = process.env.SEED_EMAIL || "admin@lifeos.app";

async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === "y" || answer.toLowerCase() === "yes");
    });
  });
}

async function main() {
  neonConfig.webSocketConstructor = ws;
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL! });
  const prisma = new PrismaClient({ adapter });

  const user = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (!user) {
    console.error(`❌ No user found with email "${EMAIL}". Nothing to reset.`);
    return;
  }

  const ok = await confirm(
    `⚠️  This will delete ALL financial data for "${EMAIL}" but keep the login.\nType "yes" to confirm: `
  );
  if (!ok) {
    console.log("Aborted.");
    return;
  }

  const uid = user.id;

  // Delete in dependency order (children before parents)
  await prisma.transaction.deleteMany({ where: { userId: uid } });
  await prisma.committeePayment.deleteMany({ where: { committee: { userId: uid } } });
  await prisma.committee.deleteMany({ where: { userId: uid } });
  await prisma.subscription.deleteMany({ where: { userId: uid } });
  await prisma.sIPInstallment.deleteMany({ where: { userId: uid } });
  await prisma.sIPChangeLog.deleteMany({ where: { userId: uid } });
  await prisma.sIP.deleteMany({ where: { userId: uid } });
  await prisma.liability.deleteMany({ where: { userId: uid } });
  await prisma.investment.deleteMany({ where: { userId: uid } });
  await prisma.fixedDeposit.deleteMany({ where: { userId: uid } });
  await prisma.account.deleteMany({ where: { userId: uid } });
  await prisma.budget.deleteMany({ where: { userId: uid } });
  await prisma.goal.deleteMany({ where: { userId: uid } });
  await prisma.watchlistItem.deleteMany({ where: { userId: uid } });
  await prisma.notification.deleteMany({ where: { userId: uid } });
  await prisma.recommendationSnapshot.deleteMany({ where: { userId: uid } });
  await prisma.offlineAsset.deleteMany({ where: { userId: uid } });

  console.log("✅ All financial data cleared.");

  // Keep categories (useful to not lose custom ones), but offer option
  const delCat = await confirm(`Delete categories too? (y/N): `);
  if (delCat) {
    await prisma.category.deleteMany({ where: { userId: uid } });
    console.log("✅ Categories deleted");
  }

  console.log(`\n✅ Reset complete. Login still works: ${EMAIL}\nRun "npm run db:seed" to re-seed.\n`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
