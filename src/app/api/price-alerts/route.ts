import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { z } from "zod";

const schema = z.object({
  symbol: z.string().min(1),
  targetPrice: z.number().positive(),
  direction: z.enum(["below", "above"]).default("below"),
  notifyOnce: z.boolean().optional(),
  cooldownMinutes: z.number().int().min(1).max(1440).optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const rows = await prisma.priceAlert.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return NextResponse.json(
      rows.map((row) => ({
        ...row,
        targetPrice: Number(row.targetPrice),
      }))
    );
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const parsed = schema.parse(body);
    const symbol = parsed.symbol.trim().toUpperCase();
    const alert = await prisma.priceAlert.create({
      data: {
        userId: user.id,
        symbol,
        targetPrice: parsed.targetPrice,
        direction: parsed.direction,
        notifyOnce: parsed.notifyOnce ?? true,
        cooldownMinutes: parsed.cooldownMinutes ?? 60,
      },
    });
    return NextResponse.json(
      { ...alert, targetPrice: Number(alert.targetPrice) },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const updated = await prisma.priceAlert.updateMany({
      where: { id: body.id, userId: user.id },
      data: {
        status: body.status,
        notifyOnce: typeof body.notifyOnce === "boolean" ? body.notifyOnce : undefined,
        direction: body.direction,
        targetPrice: typeof body.targetPrice === "number" ? body.targetPrice : undefined,
        cooldownMinutes:
          typeof body.cooldownMinutes === "number" ? Math.max(1, Math.min(1440, Math.floor(body.cooldownMinutes))) : undefined,
      },
    });
    if (!updated.count) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await prisma.priceAlert.deleteMany({ where: { id, userId: user.id } });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
