import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { syncSipsForUser } from "@/lib/sip-sync";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await prisma.user.findMany({
      select: { id: true },
    });

    let totalPriceUpdated = 0;
    let totalInstallmentsPosted = 0;
    for (const u of users) {
      const result = await syncSipsForUser(u.id);
      totalPriceUpdated += result.priceUpdated;
      totalInstallmentsPosted += result.installmentsPosted;
    }

    return NextResponse.json({
      users: users.length,
      priceUpdated: totalPriceUpdated,
      installmentsPosted: totalInstallmentsPosted,
    });
  } catch (error) {
    console.error("SIP sync cron error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}

