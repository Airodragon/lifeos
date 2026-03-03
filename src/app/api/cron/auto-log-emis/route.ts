import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { toDateInputValueIST, istDayStart, istDayEnd } from "@/lib/utils";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    const todayKey = toDateInputValueIST(today);
    const todayStart = istDayStart(todayKey);
    const todayEnd = istDayEnd(todayKey);
    const todayDayOfMonth = today.getDate();

    // Get all active liabilities with an EMI amount
    const liabilities = await prisma.liability.findMany({
      where: {
        emiAmount: { not: null, gt: 0 },
      },
    });

    let logged = 0;
    let skipped = 0;

    for (const liability of liabilities) {
      const emiDueDay = new Date(liability.startDate).getDate();
      if (emiDueDay !== todayDayOfMonth) {
        skipped++;
        continue;
      }

      // Check if liability has already ended
      if (liability.endDate && liability.endDate < today) {
        skipped++;
        continue;
      }

      // Dedup: check if an EMI transaction for this liability was already logged today
      const existing = await prisma.transaction.findFirst({
        where: {
          userId: liability.userId,
          source: "emi",
          description: { contains: liability.id },
          date: { gte: todayStart, lte: todayEnd },
          deletedAt: null,
        },
        select: { id: true },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.transaction.create({
        data: {
          userId: liability.userId,
          amount: liability.emiAmount!,
          type: "expense",
          description: `${liability.name} EMI [${liability.id}]`,
          date: today,
          source: "emi",
          tags: ["emi", "auto"],
        },
      });
      logged++;
    }

    return NextResponse.json({ logged, skipped });
  } catch (error) {
    console.error("EMI auto-log cron error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
