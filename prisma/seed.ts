import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { hash } from "bcryptjs";
import "dotenv/config";

const EMAIL = process.env.SEED_EMAIL || "admin@lifeos.app";
const PASSWORD = process.env.SEED_PASSWORD || "changeme123";
const NAME = process.env.SEED_NAME || "Admin";

async function main() {
  const connectionString = process.env.DATABASE_URL!;
  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  const existing = await prisma.user.findUnique({ where: { email: EMAIL } });
  if (existing) {
    console.log(`User "${EMAIL}" already exists. Skipping.`);
    return;
  }

  const passwordHash = await hash(PASSWORD, 12);

  const user = await prisma.user.create({
    data: {
      email: EMAIL,
      passwordHash,
      name: NAME,
      onboarded: true,
      categories: {
        createMany: {
          data: [
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
            { name: "Other", icon: "MoreHorizontal", color: "#6b7280", type: "expense" },
            { name: "Salary", icon: "Briefcase", color: "#0ea5e9", type: "income" },
            { name: "Freelance", icon: "Laptop", color: "#22c55e", type: "income" },
            { name: "Investment", icon: "TrendingUp", color: "#10b981", type: "income" },
            { name: "Other Income", icon: "Wallet", color: "#64748b", type: "income" },
          ],
        },
      },
    },
  });

  console.log(`\nAccount created successfully!`);
  console.log(`  Email:    ${EMAIL}`);
  console.log(`  Password: ${PASSWORD}`);
  console.log(`  User ID:  ${user.id}\n`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
