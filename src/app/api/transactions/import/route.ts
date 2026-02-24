import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { parseBankStatementCsv, parseBankStatementPdf } from "@/lib/bank-import";
import { categorizeTransaction } from "@/lib/openai";

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
    const contentType = req.headers.get("content-type") || "";
    let accountId: string | null = null;
    let parsed: ReturnType<typeof parseBankStatementCsv> = [];
    let sourceLabel: "bank_import" | "bank_import_pdf" = "bank_import";

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      accountId = formData.get("accountId") ? String(formData.get("accountId")) : null;
      const file = formData.get("file");
      if (!(file instanceof File)) {
        return NextResponse.json({ error: "File is required" }, { status: 400 });
      }
      const name = file.name.toLowerCase();
      if (name.endsWith(".csv")) {
        const csvText = await file.text();
        parsed = parseBankStatementCsv(csvText);
      } else if (name.endsWith(".pdf")) {
        const buffer = Buffer.from(await file.arrayBuffer());
        parsed = await parseBankStatementPdf(buffer);
        sourceLabel = "bank_import_pdf";
      } else {
        return NextResponse.json({ error: "Only CSV or PDF files are supported" }, { status: 400 });
      }
    } else {
      const body = await req.json();
      const csvText = String(body.csvText || "");
      accountId = body.accountId ? String(body.accountId) : null;
      if (!csvText.trim()) {
        return NextResponse.json({ error: "CSV content is required" }, { status: 400 });
      }
      parsed = parseBankStatementCsv(csvText);
    }

    if (accountId) {
      const account = await prisma.account.findFirst({
        where: { id: accountId, userId: user.id },
      });
      if (!account) {
        return NextResponse.json({ error: "Invalid account" }, { status: 400 });
      }
    }

    if (!parsed.length) {
      return NextResponse.json(
        { error: "No valid transactions found in file" },
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
    let categorized = 0;
    const userCategories = await prisma.category.findMany({ where: { userId: user.id } });
    const categoryByName = new Map(
      userCategories.map((c) => [c.name.toLowerCase().trim(), c])
    );
    const categoryCache = new Map<string, { categoryId?: string; tags: string[] }>();

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

      let categoryId: string | undefined;
      let tags: string[] = ["bank-import"];
      const cacheKey = `${txn.type}|${normalizeDescription(txn.description).slice(0, 80)}`;
      const cached = categoryCache.get(cacheKey);
      if (cached) {
        categoryId = cached.categoryId;
        tags = Array.from(new Set([...tags, ...cached.tags]));
      } else {
        const categorization = await categorizeTransaction(txn.description, txn.amount);
        const matchedCategory = categoryByName.get(
          String(categorization.category || "").toLowerCase().trim()
        );
        if (matchedCategory) {
          categoryId = matchedCategory.id;
          categorized++;
        }
        const categoryTags = Array.isArray(categorization.tags) ? categorization.tags : [];
        const cachedValue = {
          categoryId,
          tags: categoryTags.slice(0, 8),
        };
        categoryCache.set(cacheKey, cachedValue);
        tags = Array.from(new Set([...tags, ...cachedValue.tags]));
      }

      await prisma.transaction.create({
        data: {
          userId: user.id,
          accountId,
          amount: txn.amount,
          type: txn.type,
          description: txn.description.slice(0, 300),
          date: txn.date,
          source: sourceLabel,
          categoryId,
          tags,
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
      source: sourceLabel,
      totalRows: parsed.length,
      imported,
      matchedExisting,
      skipped,
      categorized,
    });
  } catch {
    return NextResponse.json({ error: "Import failed" }, { status: 500 });
  }
}

