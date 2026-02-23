import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchTransactionEmails } from "@/lib/email-parser";
import { categorizeTransaction } from "@/lib/openai";

export async function GET(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connections = await prisma.emailConnection.findMany({
      include: { user: { include: { categories: true } } },
    });

    let synced = 0;

    for (const conn of connections) {
      const transactions = await fetchTransactionEmails(
        { accessToken: conn.accessToken, refreshToken: conn.refreshToken },
        conn.lastSyncAt || undefined
      );

      for (const txn of transactions) {
        const existing = await prisma.transaction.findFirst({
          where: { userId: conn.userId, emailRef: txn.emailRef },
        });
        if (existing) continue;

        const categorization = await categorizeTransaction(
          txn.description,
          txn.amount,
          txn.merchant
        );

        const category = conn.user.categories.find(
          (c) => c.name === categorization.category
        );

        await prisma.transaction.create({
          data: {
            userId: conn.userId,
            amount: txn.amount,
            type: txn.type,
            description: `${txn.merchant}: ${txn.description}`,
            date: new Date(txn.date),
            source: "email",
            emailRef: txn.emailRef,
            categoryId: category?.id,
            tags: categorization.tags,
          },
        });
        synced++;
      }

      await prisma.emailConnection.update({
        where: { id: conn.id },
        data: { lastSyncAt: new Date() },
      });
    }

    return NextResponse.json({ synced });
  } catch (error) {
    console.error("Email sync error:", error);
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
