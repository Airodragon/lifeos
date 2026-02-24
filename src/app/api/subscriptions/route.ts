import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { SUBSCRIPTION_CADENCES, normalizeCadence, parseDueDateInput } from "@/lib/subscriptions";

const createSchema = z.object({
  name: z.string().min(1),
  merchant: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().default("INR"),
  cadence: z.enum(SUBSCRIPTION_CADENCES),
  nextDueDate: z.string(),
  endDate: z.string().nullable().optional(),
  paymentAccountId: z.string().nullable().optional(),
  paymentMethodLabel: z.string().optional(),
  remindDaysBefore: z.number().int().min(0).max(30).default(1),
  active: z.boolean().default(true),
  category: z.string().optional(),
  notes: z.string().optional(),
});

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const where: Record<string, unknown> = { userId: user.id };
    if (status === "active") where.active = true;
    if (status === "inactive") where.active = false;

    const subscriptions = await prisma.subscription.findMany({
      where,
      include: {
        paymentAccount: {
          select: { id: true, name: true, type: true },
        },
      },
      orderBy: [{ nextDueDate: "asc" }, { createdAt: "desc" }],
    });
    return NextResponse.json(subscriptions);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const data = createSchema.parse(body);
    const cadence = normalizeCadence(data.cadence);

    if (data.paymentAccountId) {
      const account = await prisma.account.findFirst({
        where: { id: data.paymentAccountId, userId: user.id },
        select: { id: true },
      });
      if (!account) {
        return NextResponse.json({ error: "Payment account not found" }, { status: 400 });
      }
    }

    const subscription = await prisma.subscription.create({
      data: {
        userId: user.id,
        paymentAccountId: data.paymentAccountId || null,
        name: data.name,
        merchant: data.merchant,
        amount: data.amount,
        currency: data.currency || "INR",
        cadence,
        nextDueDate: parseDueDateInput(data.nextDueDate),
        endDate: data.endDate ? parseDueDateInput(data.endDate) : null,
        remindDaysBefore: data.remindDaysBefore,
        active: data.active,
        category: data.category,
        paymentMethodLabel: data.paymentMethodLabel,
        notes: data.notes,
      },
      include: {
        paymentAccount: {
          select: { id: true, name: true, type: true },
        },
      },
    });
    return NextResponse.json(subscription, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    if (error instanceof Error && error.message === "Invalid cadence") {
      return NextResponse.json({ error: "Invalid cadence" }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
