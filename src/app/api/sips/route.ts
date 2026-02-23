import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1),
  fundName: z.string().min(1),
  amount: z.number().positive(),
  frequency: z.enum(["monthly", "weekly", "quarterly"]).optional(),
  sipDate: z.number().min(1).max(31).optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  totalInvested: z.number().optional(),
  currentValue: z.number().optional(),
  units: z.number().optional(),
  expectedReturn: z.number().optional(),
});

export async function GET() {
  try {
    const user = await requireUser();
    const sips = await prisma.sIP.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(sips);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const data = createSchema.parse(body);

    const sip = await prisma.sIP.create({
      data: {
        userId: user.id,
        name: data.name,
        fundName: data.fundName,
        amount: data.amount,
        frequency: data.frequency || "monthly",
        sipDate: data.sipDate || 1,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        totalInvested: data.totalInvested || 0,
        currentValue: data.currentValue || 0,
        units: data.units || 0,
        expectedReturn: data.expectedReturn || 12,
      },
    });

    return NextResponse.json(sip, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
