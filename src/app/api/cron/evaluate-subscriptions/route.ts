import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createNotificationAndPush } from "@/lib/notifications";
import { istDayEnd, istDayStart, toDateInputValueIST } from "@/lib/utils";

function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dayDiffFromTodayInIST(todayKey: string, dueKey: string) {
  const t = istDayStart(todayKey).getTime();
  const d = istDayStart(dueKey).getTime();
  return Math.round((d - t) / 86400000);
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const today = new Date();
    const todayKey = toDateInputValueIST(today);
    const maxWindowEnd = istDayEnd(toDateInputValueIST(addDays(today, 30)));

    const subscriptions = await prisma.subscription.findMany({
      where: {
        active: true,
        nextDueDate: { lte: maxWindowEnd },
      },
      include: {
        paymentAccount: { select: { id: true, name: true, type: true } },
      },
      orderBy: { nextDueDate: "asc" },
    });

    let notified = 0;
    let checked = 0;

    for (const sub of subscriptions) {
      checked++;
      const dueKey = toDateInputValueIST(sub.nextDueDate);
      const diffDays = dayDiffFromTodayInIST(todayKey, dueKey);

      let stage: "due_soon" | "due_today" | "overdue" | null = null;
      if (diffDays < 0) {
        stage = "overdue";
      } else if (diffDays === 0) {
        stage = "due_today";
      } else if (diffDays <= sub.remindDaysBefore) {
        stage = "due_soon";
      }
      if (!stage) continue;

      const dedupeToken = `"subscriptionId":"${sub.id}","dueDate":"${dueKey}","stage":"${stage}"`;
      const existing = await prisma.notification.findFirst({
        where: {
          userId: sub.userId,
          type: "bill_reminder",
          data: { contains: dedupeToken },
        },
        select: { id: true },
      });
      if (existing) continue;

      const accountText = sub.paymentAccount?.name || sub.paymentMethodLabel || "your selected account";
      const merchantText = sub.merchant || sub.name;
      const title =
        stage === "due_today"
          ? `Subscription due today: ${merchantText}`
          : stage === "due_soon"
            ? `Subscription due soon: ${merchantText}`
            : `Subscription overdue: ${merchantText}`;
      const message =
        stage === "due_today"
          ? `${merchantText} (${sub.currency} ${Number(sub.amount).toFixed(
              2
            )}) is due today on ${accountText}.`
          : stage === "due_soon"
            ? `${merchantText} (${sub.currency} ${Number(sub.amount).toFixed(
                2
              )}) is due in ${diffDays} day(s) on ${accountText}.`
            : `${merchantText} (${sub.currency} ${Number(sub.amount).toFixed(
                2
              )}) is overdue from ${dueKey}. Please review payment on ${accountText}.`;

      await createNotificationAndPush({
        userId: sub.userId,
        title,
        message,
        type: "bill_reminder",
        data: {
          source: "subscription_reminder",
          subscriptionId: sub.id,
          dueDate: dueKey,
          stage,
          cadence: sub.cadence,
        },
        url: "/subscriptions",
      });
      notified++;
    }

    return NextResponse.json({ checked, notified });
  } catch (error) {
    console.error("Subscriptions cron error:", error);
    return NextResponse.json({ error: "Evaluation failed" }, { status: 500 });
  }
}
