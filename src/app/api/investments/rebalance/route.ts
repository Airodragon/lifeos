import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";

type TargetInput = Record<string, number>;

const DEFAULT_TARGETS: TargetInput = {
  stock: 45,
  etf: 30,
  mutual_fund: 20,
  crypto: 5,
};

function normalizeTargets(targets?: TargetInput) {
  const raw = { ...DEFAULT_TARGETS, ...(targets || {}) };
  const sum = Object.values(raw).reduce((s, n) => s + Math.max(0, n), 0) || 1;
  const normalized: TargetInput = {};
  for (const [k, v] of Object.entries(raw)) {
    normalized[k] = (Math.max(0, v) / sum) * 100;
  }
  return normalized;
}

function round(n: number) {
  return Math.round(n * 100) / 100;
}

async function buildRebalancePayload(userId: string, targets?: TargetInput) {
  const investments = await prisma.investment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const normalizedTargets = normalizeTargets(targets);

  const holdings = investments.map((inv) => {
    const qty = Number(inv.quantity);
    const current = Number(inv.currentPrice ?? inv.avgBuyPrice);
    const value = qty * current;
    return {
      id: inv.id,
      symbol: inv.symbol,
      name: inv.name,
      type: inv.type,
      qty,
      current,
      value,
    };
  });
  const totalValue = holdings.reduce((sum, h) => sum + h.value, 0);

  const exposureMap = new Map<string, number>();
  for (const h of holdings) {
    exposureMap.set(h.type, (exposureMap.get(h.type) || 0) + h.value);
  }

  const drift = Object.keys(normalizedTargets).map((assetType) => {
    const currentValue = exposureMap.get(assetType) || 0;
    const currentWeight = totalValue > 0 ? (currentValue / totalValue) * 100 : 0;
    const targetWeight = normalizedTargets[assetType];
    const targetValue = (targetWeight / 100) * totalValue;
    const adjustmentValue = targetValue - currentValue;
    return {
      assetType,
      currentValue: round(currentValue),
      currentWeight: round(currentWeight),
      targetWeight: round(targetWeight),
      driftPercent: round(currentWeight - targetWeight),
      suggestedAction:
        adjustmentValue > 0 ? "buy" : adjustmentValue < 0 ? "reduce" : "hold",
      adjustmentValue: round(adjustmentValue),
    };
  });

  const symbolSuggestions = holdings.map((h) => {
    const typeDrift = drift.find((d) => d.assetType === h.type);
    const adjustmentValue = typeDrift?.adjustmentValue || 0;
    const proportionalAdjustment =
      Math.abs(adjustmentValue) > 0 && (exposureMap.get(h.type) || 0) > 0
        ? (h.value / (exposureMap.get(h.type) || 1)) * adjustmentValue
        : 0;
    const units = h.current > 0 ? proportionalAdjustment / h.current : 0;
    return {
      symbol: h.symbol,
      name: h.name,
      type: h.type,
      currentValue: round(h.value),
      action: proportionalAdjustment > 0 ? "buy" : proportionalAdjustment < 0 ? "reduce" : "hold",
      adjustmentValue: round(proportionalAdjustment),
      suggestedUnits: round(units),
    };
  });

  return {
    targets: Object.fromEntries(
      Object.entries(normalizedTargets).map(([k, v]) => [k, round(v)])
    ),
    totalValue: round(totalValue),
    drift,
    symbolSuggestions,
    exposureChart: drift.map((d) => ({
      type: d.assetType,
      currentValue: d.currentValue,
      targetValue: round(d.currentValue + d.adjustmentValue),
      currentWeight: d.currentWeight,
      targetWeight: d.targetWeight,
      drift: d.driftPercent,
    })),
    allocationDonut: drift.map((d) => ({
      name: d.assetType,
      value: d.currentValue,
      color:
        d.assetType === "stock"
          ? "#3b82f6"
          : d.assetType === "etf"
            ? "#8b5cf6"
            : d.assetType === "mutual_fund"
              ? "#22c55e"
              : "#f97316",
    })),
  };
}

export async function GET() {
  try {
    const user = await requireUser();
    const payload = await buildRebalancePayload(user.id);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = (await req.json().catch(() => ({}))) as { targets?: TargetInput };
    const payload = await buildRebalancePayload(user.id, body.targets);
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
