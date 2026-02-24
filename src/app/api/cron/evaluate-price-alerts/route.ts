import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getQuotes } from "@/lib/yahoo-finance";
import { createNotificationAndPush } from "@/lib/notifications";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const activeAlerts = await prisma.priceAlert.findMany({
      where: { status: "active" },
      select: {
        id: true,
        userId: true,
        symbol: true,
        direction: true,
        targetPrice: true,
        notifyOnce: true,
        cooldownMinutes: true,
        lastNotifiedAt: true,
      },
    });
    if (activeAlerts.length === 0) {
      return NextResponse.json({ checked: 0, triggered: 0 });
    }

    const symbols = [...new Set(activeAlerts.map((item) => item.symbol))];
    const quotes = await getQuotes(symbols);
    let triggered = 0;

    for (const alert of activeAlerts) {
      const quote = quotes.get(alert.symbol);
      if (!quote) continue;
      const price = Number(quote.price);
      const target = Number(alert.targetPrice);
      const matched =
        alert.direction === "above" ? price >= target : price <= target;

      const now = new Date();
      const cooldownMs = Math.max(1, alert.cooldownMinutes) * 60 * 1000;
      const inCooldown =
        Boolean(alert.lastNotifiedAt) &&
        now.getTime() - new Date(alert.lastNotifiedAt).getTime() < cooldownMs;

      if (!matched || inCooldown) {
        await prisma.priceAlert.update({
          where: { id: alert.id },
          data: { lastCheckedAt: now },
        });
        continue;
      }

      const title = `Price alert triggered: ${alert.symbol}`;
      const message =
        alert.direction === "above"
          ? `${alert.symbol} is at ${price.toFixed(2)}, above your target ${target.toFixed(2)}.`
          : `${alert.symbol} is at ${price.toFixed(2)}, below your target ${target.toFixed(2)}.`;

      await createNotificationAndPush({
        userId: alert.userId,
        title,
        message,
        type: "investment_alert",
        data: {
          symbol: alert.symbol,
          current: price,
          target,
          direction: alert.direction,
        },
        url: "/notifications",
      });

      await prisma.priceAlert.update({
        where: { id: alert.id },
        data: {
          status: alert.notifyOnce ? "triggered" : "active",
          triggeredAt: now,
          lastCheckedAt: now,
          lastNotifiedAt: now,
        },
      });
      triggered++;
    }

    return NextResponse.json({
      checked: activeAlerts.length,
      triggered,
    });
  } catch (error) {
    console.error("Price alert cron error:", error);
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 });
  }
}
