import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { email, password, name } = signupSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already registered" },
        { status: 409 }
      );
    }

    const passwordHash = await hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
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

    return NextResponse.json(
      { id: user.id, email: user.email },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: error.issues[0].message },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
