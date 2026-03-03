import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { istDayStart, istDayEnd, toDateInputValueIST } from "@/lib/utils";

function escapeCSV(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const type = searchParams.get("type"); // income | expense | transfer | all

    const where: Record<string, unknown> = { userId: user.id, deletedAt: null };
    if (type && type !== "all") where.type = type;
    if (startDate || endDate) {
      where.date = {
        ...(startDate && { gte: istDayStart(startDate) }),
        ...(endDate && { lte: istDayEnd(endDate) }),
      };
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        category: { select: { name: true, icon: true } },
        account: { select: { name: true, type: true } },
      },
      orderBy: { date: "desc" },
      take: 10000,
    });

    const rows: string[] = [
      "Date,Type,Amount,Description,Category,Account,Tags,Source",
    ];

    for (const txn of transactions) {
      rows.push(
        [
          escapeCSV(toDateInputValueIST(txn.date)),
          escapeCSV(txn.type),
          escapeCSV(Number(txn.amount).toFixed(2)),
          escapeCSV(txn.description),
          escapeCSV(txn.category?.name),
          escapeCSV(txn.account?.name),
          escapeCSV(txn.tags.join("; ")),
          escapeCSV(txn.source),
        ].join(",")
      );
    }

    const csv = rows.join("\n");
    const now = new Date();
    const filename = `lifeos-transactions-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
