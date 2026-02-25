import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";
import "dotenv/config";

const CONFIRM_TOKEN = "WIPE_KEEP_USERS";

function hasForceFlag() {
  return process.argv.includes("--force");
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is missing.");
  }
  neonConfig.webSocketConstructor = ws;

  if (!hasForceFlag()) {
    console.log(`Refusing to run without --force.`);
    console.log(
      `Usage: npx tsx scripts/reset-user-data.ts --force`
    );
    console.log(
      `This will delete all app data and keep only login credentials (User + Authenticator).`
    );
    process.exit(1);
  }

  if (process.env.CONFIRM_RESET_DATA !== CONFIRM_TOKEN) {
    console.log("Safety check failed.");
    console.log(
      `Set CONFIRM_RESET_DATA=${CONFIRM_TOKEN} and re-run.`
    );
    process.exit(1);
  }

  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const usersBefore = await prisma.user.count();
    const authBefore = await prisma.authenticator.count();

    await prisma.$transaction(async (tx) => {
      await tx.pushSubscription.deleteMany();
      await tx.recommendationSnapshot.deleteMany();
      await tx.notification.deleteMany();
      await tx.priceAlert.deleteMany();
      await tx.watchlistItem.deleteMany();
      await tx.creditCardPayment.deleteMany();
      await tx.subscription.deleteMany();
      await tx.budget.deleteMany();
      await tx.transaction.deleteMany();
      await tx.committeePayment.deleteMany();
      await tx.committee.deleteMany();
      await tx.valuationHistory.deleteMany();
      await tx.document.deleteMany();
      await tx.offlineAsset.deleteMany();
      await tx.dividend.deleteMany();
      await tx.investmentTransaction.deleteMany();
      await tx.investment.deleteMany();
      await tx.sIPInstallment.deleteMany();
      await tx.sIPChangeLog.deleteMany();
      await tx.sIP.deleteMany();
      await tx.fixedDeposit.deleteMany();
      await tx.liability.deleteMany();
      await tx.goal.deleteMany();
      await tx.category.deleteMany();
      await tx.emailConnection.deleteMany();
    });

    const usersAfter = await prisma.user.count();
    const authAfter = await prisma.authenticator.count();

    console.log("Data wipe completed.");
    console.log(`Users kept: ${usersAfter} (before: ${usersBefore})`);
    console.log(`Authenticators kept: ${authAfter} (before: ${authBefore})`);
    console.log("All non-auth data has been deleted.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Reset failed:", error);
  process.exit(1);
});
