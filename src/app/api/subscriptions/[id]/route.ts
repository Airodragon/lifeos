import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import {
  SUBSCRIPTION_CADENCES,
  computeNextDueAfterPayment,
  normalizeCadence,
  parseDueDateInput,
} from "@/lib/subscriptions";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  merchant: z.string().nullable().optional(),
  amount: z.number().positive().optional(),
  currency: z.string().optional(),
  cadence: z.enum(SUBSCRIPTION_CADENCES).optional(),
  nextDueDate: z.string().optional(),
  endDate: z.string().nullable().optional(),
  paymentAccountId: z.string().nullable().optional(),
  paymentMethodLabel: z.string().nullable().optional(),
  remindDaysBefore: z.number().int().min(0).max(30).optional(),
  active: z.boolean().optional(),
  category: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  action: z.enum(["mark_paid", "skip", "pause", "resume"]).optional(),
});

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const subscription = await prisma.subscription.findFirst({
      where: { id, userId: user.id },
      include: {
        paymentAccount: {
          select: { id: true, name: true, type: true },
        },
      },
    });
    if (!subscription) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(subscription);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = await req.json();
    const data = updateSchema.parse(body);

    const existing = await prisma.subscription.findFirst({
      where: { id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (data.paymentAccountId) {
      const account = await prisma.account.findFirst({
        where: { id: data.paymentAccountId, userId: user.id },
        select: { id: true },
      });
      if (!account) {
        return NextResponse.json({ error: "Payment account not found" }, { status: 400 });
      }
    }

    const action = data.action;
    if (action) {
      const cadence = normalizeCadence(existing.cadence);
      if (action === "pause") {
        const paused = await prisma.subscription.update({
          where: { id },
          data: { active: false },
          include: { paymentAccount: { select: { id: true, name: true, type: true } } },
        });
        return NextResponse.json(paused);
      }
      if (action === "resume") {
        const resumed = await prisma.subscription.update({
          where: { id },
          data: { active: true },
          include: { paymentAccount: { select: { id: true, name: true, type: true } } },
        });
        return NextResponse.json(resumed);
      }

      if (action === "mark_paid" || action === "skip") {
        if (cadence === "one_time") {
          const updated = await prisma.subscription.update({
            where: { id },
            data: { active: false },
            include: { paymentAccount: { select: { id: true, name: true, type: true } } },
          });
          return NextResponse.json(updated);
        }
        const nextDueDate = computeNextDueAfterPayment(new Date(existing.nextDueDate), cadence);
        const updated = await prisma.subscription.update({
          where: { id },
          data: { nextDueDate, active: true },
          include: { paymentAccount: { select: { id: true, name: true, type: true } } },
        });
        return NextResponse.json(updated);
      }
    }

    const cadence = data.cadence ? normalizeCadence(data.cadence) : normalizeCadence(existing.cadence);
    const updated = await prisma.subscription.update({
      where: { id },
      data: {
        name: data.name ?? existing.name,
        merchant: data.merchant === undefined ? existing.merchant : data.merchant,
        amount: data.amount ?? existing.amount,
        currency: data.currency ?? existing.currency,
        cadence,
        nextDueDate: data.nextDueDate ? parseDueDateInput(data.nextDueDate) : existing.nextDueDate,
        endDate:
          data.endDate === undefined
            ? existing.endDate
            : data.endDate
              ? parseDueDateInput(data.endDate)
              : null,
        paymentAccountId:
          data.paymentAccountId === undefined ? existing.paymentAccountId : data.paymentAccountId || null,
        paymentMethodLabel:
          data.paymentMethodLabel === undefined
            ? existing.paymentMethodLabel
            : data.paymentMethodLabel || null,
        remindDaysBefore: data.remindDaysBefore ?? existing.remindDaysBefore,
        active: data.active ?? existing.active,
        category: data.category === undefined ? existing.category : data.category || null,
        notes: data.notes === undefined ? existing.notes : data.notes || null,
      },
      include: {
        paymentAccount: {
          select: { id: true, name: true, type: true },
        },
      },
    });

    return NextResponse.json(updated);
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

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const existing = await prisma.subscription.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await prisma.subscription.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
