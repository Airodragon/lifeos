import { prisma } from "@/lib/prisma";
import { fetchTransactionEmails } from "@/lib/email-parser";
import { categorizeTransaction } from "@/lib/openai";

export async function syncEmailConnection(connectionId: string) {
  const conn = await prisma.emailConnection.findUnique({
    where: { id: connectionId },
    include: { user: { include: { categories: true } } },
  });
  if (!conn) return { synced: 0 };

  const transactions = await fetchTransactionEmails(
    { accessToken: conn.accessToken, refreshToken: conn.refreshToken },
    conn.lastSyncAt || undefined
  );

  let synced = 0;
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

  return { synced };
}
