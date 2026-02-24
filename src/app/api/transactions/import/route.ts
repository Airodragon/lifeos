import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseBankStatementCsv } from "@/lib/bank-import";

const MAX_IMPORT_ROWS = 2000;

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function sameAmount(a: number, b: number) {
  return Math.abs(a - b) <= 0.01;
}

function normalizeDescription(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await req.json();
    const csvText = String(body.csvText || "");
    const accountId = body.accountId ? String(body.accountId) : null;

    if (!csvText.trim()) {
      return NextResponse.json({ error: "CSV content is required" }, { status: 400 });
    }

    if (accountId) {
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId: user.id },
      });
      if (!account) {
        return NextResponse.json({ error: "Invalid account" }, { status: 400 });
      }
    }

    const parsed = parseBankStatementCsv(csvText);
    if (!parsed.length) {
      return NextResponse.json(
        { error: "No valid transactions found in CSV" },
        { status: 400 }
      );
    }
    if (parsed.length > MAX_IMPORT_ROWS) {
      return NextResponse.json(
        { error: `CSV too large. Please import up to ${MAX_IMPORT_ROWS} rows at once.` },
        { status: 400 }
      );
    }

    let imported = 0;
    let matchedExisting = 0;
    let skipped = 0;

    for (const txn of parsed) {
      if (!Number.isFinite(txn.amount) || txn.amount <= 0) {
        skipped++;
        continue;
      }
      const normalizedImportedDesc = normalizeDescription(txn.description);
      const existingByWindow = await prisma.transaction.findMany({
        where: {
          userId: user.id,
          type: txn.type,
          date: {
            gte: startOfDay(new Date(txn.date.getTime() - 86400000)),
            lte: endOfDay(new Date(txn.date.getTime() + 86400000)),
          },
        },
        take: 20,
      });

      const probableMatch = existingByWindow.find((t) => {
        const tAmount = Number(t.amount);
        const existingDesc = normalizeDescription(t.description || "");
        return (
          sameAmount(tAmount, txn.amount) &&
          (existingDesc.includes(normalizedImportedDesc.slice(0, 12)) ||
            normalizedImportedDesc.includes(existingDesc.slice(0, 12)))
        );
      });

      if (probableMatch) {
        matchedExisting++;
        continue;
      }

      await prisma.transaction.create({
        data: {
          userId: user.id,
          accountId,
          amount: txn.amount,
          type: txn.type,
          description: txn.description.slice(0, 300),
          date: txn.date,
          source: "bank_import",
          tags: ["bank-import"],
        },
      });

      if (accountId) {
        await prisma.account.update({
          where: { id: accountId },
          data: {
            balance: {
              increment: txn.type === "income" ? txn.amount : -txn.amount,
            },
          },
        });
      }

      imported++;
    }
    return NextResponse.json({
      totalRows: parsed.length,
      imported,
      matchedExisting,
      skipped,
    });
  } catch {
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}

