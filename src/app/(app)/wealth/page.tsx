"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TrendingUp,
  Plus,
  ShieldAlert,
  RefreshCw,
  Brain,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { useFormat } from "@/hooks/use-format";
import { toDecimal } from "@/lib/utils";
import Link from "next/link";
import { toast } from "sonner";

interface Investment {
  id: string;
  symbol: string;
  name: string;
  type: string;
  quantity: string;
  avgBuyPrice: string;
  currentPrice: string | null;
}

interface Liability {
  id: string;
  name: string;
  type: string;
  principal: string;
  outstanding: string;
  interestRate: string;
  emiAmount: string | null;
  startDate: string;
  endDate: string | null;
}

interface SIP {
  id: string;
  amount: string;
  currentValue: string;
  status: string;
}

interface Committee {
  id: string;
  name: string;
  payoutAmount: string;
  status: string;
}

interface FixedDeposit {
  id: string;
  principal: string;
  maturityAmount: string;
  status: string;
}

interface Account {
  id: string;
  type: string;
  balance: string;
}

interface AIInsights {
  summary: string;
  suggestions: string[];
  alerts: string[];
  opportunities: string[];
}

interface TaxSummary {
  totals: {
    totalEstimatedTax: number;
    stcgTaxEstimate: number;
    ltcgTaxEstimate: number;
  };
}

const TRACKING_START = "2026-03-01";

export default function WealthPage() {
  const { fc: formatCurrency, fp: formatPercent } = useFormat();
  const [activeTab, setActiveTab] = useState("summary");
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [sips, setSips] = useState<SIP[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [fixedDeposits, setFixedDeposits] = useState<FixedDeposit[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [ai, setAi] = useState<AIInsights | null>(null);
  const [tax, setTax] = useState<TaxSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingLive, setRefreshingLive] = useState(false);
  const [showAddLiability, setShowAddLiability] = useState(false);
  const [editLiabilityId, setEditLiabilityId] = useState<string | null>(null);
  const [liabilityForm, setLiabilityForm] = useState({
    name: "",
    type: "vehicle",
    principal: "",
    outstanding: "",
    interestRate: "",
    emiAmount: "",
    startDate: TRACKING_START,
    endDate: "",
  });
  const resetLiabilityForm = () => {
    setLiabilityForm({
      name: "",
      type: "vehicle",
      principal: "",
      outstanding: "",
      interestRate: "",
      emiAmount: "",
      startDate: TRACKING_START,
      endDate: "",
    });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [invRes, liabRes, sipRes, committeeRes, fdRes, accountRes, aiRes, taxRes] = await Promise.all([
      fetch("/api/investments"),
      fetch("/api/liabilities"),
      fetch("/api/sips"),
      fetch("/api/committees"),
      fetch("/api/fixed-deposits"),
      fetch("/api/accounts"),
      fetch("/api/ai/insights").catch(() => null),
      fetch("/api/investments/tax-center").catch(() => null),
    ]);
    const invData = await invRes.json();
    const liabData = await liabRes.json();
    const sipData = await sipRes.json();
    const committeeData = await committeeRes.json();
    const fdData = await fdRes.json();
    const accountData = await accountRes.json();
    const aiData = aiRes ? await aiRes.json() : null;
    const taxData = taxRes ? await taxRes.json() : null;
    setInvestments(invData || []);
    setLiabilities(liabData || []);
    setSips(sipData || []);
    setCommittees(committeeData || []);
    setFixedDeposits(fdData || []);
    setAccounts(accountData || []);
    if (aiData && !aiData.error) setAi(aiData);
    if (taxData && !taxData.error) setTax(taxData);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const investmentTotals = useMemo(() => {
    const rows = investments.map((inv) => {
      const qty = toDecimal(inv.quantity);
      const avg = toDecimal(inv.avgBuyPrice);
      const current = toDecimal(inv.currentPrice) || avg;
      const value = qty * current;
      const invested = qty * avg;
      return { ...inv, value, invested, gain: value - invested };
    });
    const totalValue = rows.reduce((sum, row) => sum + row.value, 0);
    const totalInvested = rows.reduce((sum, row) => sum + row.invested, 0);
    const totalGain = totalValue - totalInvested;
    return { rows, totalValue, totalInvested, totalGain };
  }, [investments]);

  const assetBreakdown = useMemo(() => {
    const mf = investmentTotals.rows
      .filter((row) => row.type === "mutual_fund")
      .reduce((sum, row) => sum + row.value, 0);
    const stocks = investmentTotals.rows
      .filter((row) => row.type !== "mutual_fund")
      .reduce((sum, row) => sum + row.value, 0);
    const sip = sips
      .filter((s) => s.status === "active" || s.status === "paused")
      .reduce((sum, s) => sum + toDecimal(s.currentValue), 0);
    const committee = committees
      .filter((c) => c.status === "active")
      .reduce((sum, c) => sum + toDecimal(c.payoutAmount), 0);
    const fd = fixedDeposits
      .filter((f) => f.status === "active")
      .reduce((sum, f) => sum + toDecimal(f.maturityAmount || f.principal), 0);
    const totalAssets = mf + stocks + sip + committee + fd;
    return { mf, stocks, sip, committee, fd, totalAssets };
  }, [committees, fixedDeposits, investmentTotals.rows, sips]);

  const liabilityTotals = useMemo(() => {
    const principal = liabilities.reduce((sum, l) => sum + toDecimal(l.principal), 0);
    const outstanding = liabilities.reduce((sum, l) => sum + toDecimal(l.outstanding), 0);
    const emi = liabilities.reduce((sum, l) => sum + toDecimal(l.emiAmount), 0);
    const creditCardExpense = accounts
      .filter((a) => a.type === "credit_card")
      .reduce((sum, a) => sum + Math.abs(toDecimal(a.balance)), 0);
    return { principal, outstanding, emi, creditCardExpense };
  }, [accounts, liabilities]);

  const currentBankBalance = useMemo(() => {
    return accounts
      .filter((a) => a.type !== "credit_card")
      .reduce((sum, a) => sum + toDecimal(a.balance), 0);
  }, [liabilities]);

  const projection = useMemo(() => {
    const monthlySip = sips
      .filter((s) => s.status === "active")
      .reduce((sum, s) => sum + toDecimal(s.amount), 0);
    const monthlyDebtOut = liabilityTotals.emi + liabilityTotals.creditCardExpense * 0.05;
    const netCurrent = assetBreakdown.totalAssets - (liabilityTotals.outstanding + liabilityTotals.creditCardExpense);
    const monthlyNetFlow = monthlySip - monthlyDebtOut;
    const projected12 = netCurrent * 1.06 + monthlyNetFlow * 12;
    return { monthlySip, monthlyDebtOut, netCurrent, projected12 };
  }, [assetBreakdown.totalAssets, liabilityTotals.creditCardExpense, liabilityTotals.emi, liabilityTotals.outstanding, sips]);

  const refreshLiveValues = async () => {
    setRefreshingLive(true);
    try {
      const symbols = investments.map((i) => i.symbol).filter(Boolean);
      let investmentUpdated = 0;
      if (symbols.length) {
        const quoteRes = await fetch("/api/market-data/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ symbols }),
        });
        if (quoteRes.ok) {
          const quotes: Record<string, number> = await quoteRes.json();
          const updates = investments
            .filter((inv) => quotes[inv.symbol])
            .map((inv) =>
              fetch(`/api/investments/${inv.id}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  currentPrice: quotes[inv.symbol],
                  lastUpdated: new Date().toISOString(),
                }),
              })
            );
          investmentUpdated = updates.length;
          await Promise.all(updates);
        }
      }

      const sipRes = await fetch("/api/sips/refresh", { method: "POST" });
      const sipData = await sipRes.json().catch(() => ({}));
      await fetchData();
      toast.success(
        `Live refresh complete · MF/Stocks ${investmentUpdated} · SIP ${sipData.priceUpdated ?? 0}`
      );
    } catch {
      toast.error("Live refresh failed");
    } finally {
      setRefreshingLive(false);
    }
  };

  const addLiability = async () => {
    if (!liabilityForm.name || !liabilityForm.principal || !liabilityForm.interestRate) return;
    const payload = {
      name: liabilityForm.name,
      type: liabilityForm.type,
      principal: parseFloat(liabilityForm.principal),
      outstanding: liabilityForm.outstanding ? parseFloat(liabilityForm.outstanding) : parseFloat(liabilityForm.principal),
      interestRate: parseFloat(liabilityForm.interestRate),
      emiAmount: liabilityForm.emiAmount ? parseFloat(liabilityForm.emiAmount) : null,
      startDate: liabilityForm.startDate,
      endDate: liabilityForm.endDate || null,
    };
    const res = await fetch("/api/liabilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error("Failed to add liability");
      return;
    }
    toast.success("Liability added");
    setShowAddLiability(false);
    resetLiabilityForm();
    fetchData();
  };

  const openEditLiability = (liability: Liability) => {
    setEditLiabilityId(liability.id);
    setLiabilityForm({
      name: liability.name,
      type: liability.type,
      principal: toDecimal(liability.principal).toString(),
      outstanding: toDecimal(liability.outstanding).toString(),
      interestRate: toDecimal(liability.interestRate).toString(),
      emiAmount: liability.emiAmount ? toDecimal(liability.emiAmount).toString() : "",
      startDate: new Date(liability.startDate).toISOString().slice(0, 10),
      endDate: liability.endDate ? new Date(liability.endDate).toISOString().slice(0, 10) : "",
    });
  };

  const updateLiability = async () => {
    if (!editLiabilityId) return;
    if (!liabilityForm.name || !liabilityForm.principal || !liabilityForm.interestRate) return;
    const payload = {
      name: liabilityForm.name,
      type: liabilityForm.type,
      principal: parseFloat(liabilityForm.principal),
      outstanding: liabilityForm.outstanding
        ? parseFloat(liabilityForm.outstanding)
        : parseFloat(liabilityForm.principal),
      interestRate: parseFloat(liabilityForm.interestRate),
      emiAmount: liabilityForm.emiAmount ? parseFloat(liabilityForm.emiAmount) : null,
      startDate: liabilityForm.startDate,
      endDate: liabilityForm.endDate || null,
    };
    const res = await fetch(`/api/liabilities/${editLiabilityId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error("Failed to update liability");
      return;
    }
    toast.success("Liability updated");
    setEditLiabilityId(null);
    resetLiabilityForm();
    fetchData();
  };

  const removeLiability = async (id: string) => {
    const res = await fetch(`/api/liabilities/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to remove liability");
      return;
    }
    toast.success("Liability removed");
    fetchData();
  };

  return (
    <div className="p-4 space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Investment / Liability</h2>
          <p className="text-xs text-muted-foreground">
            March-first tracking flow active. Add older assets/debts manually anytime.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData}>
            Refresh
          </Button>
          <Button size="sm" onClick={refreshLiveValues} disabled={refreshingLive}>
            <RefreshCw className={`w-4 h-4 mr-1 ${refreshingLive ? "animate-spin" : ""}`} />
            Live
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Investment Value</p>
            <p className="text-sm font-semibold">{formatCurrency(assetBreakdown.totalAssets, "INR", true)}</p>
            <p className={`text-[10px] ${investmentTotals.totalGain >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(investmentTotals.totalGain, "INR", true)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Outstanding Liability</p>
            <p className="text-sm font-semibold text-destructive">
              {formatCurrency(liabilityTotals.outstanding + liabilityTotals.creditCardExpense, "INR", true)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              EMI {formatCurrency(liabilityTotals.emi, "INR", true)}/mo
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-3 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-muted-foreground">Current Bank Balance</p>
            <p className="text-base font-semibold">{formatCurrency(currentBankBalance, "INR", true)}</p>
          </div>
          <Wallet className="w-5 h-5 text-primary" />
        </CardContent>
      </Card>

      <Tabs
        tabs={[
          { id: "summary", label: "Summary" },
          { id: "investments", label: "Assets" },
          { id: "liabilities", label: "Liabilities" },
          { id: "insights", label: "Insights" },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "summary" ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Normal Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-border/40 p-2">
                <p className="text-muted-foreground">Net Current</p>
                <p className={`font-semibold ${projection.netCurrent >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(projection.netCurrent, "INR", true)}
                </p>
              </div>
              <div className="rounded-xl border border-border/40 p-2">
                <p className="text-muted-foreground">12M Projection</p>
                <p className={`font-semibold ${projection.projected12 >= 0 ? "text-success" : "text-destructive"}`}>
                  {formatCurrency(projection.projected12, "INR", true)}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground">
              Projection uses current net wealth + 6% annual growth + monthly SIP minus EMI and minimum credit card repayment.
            </p>
          </CardContent>
        </Card>
      ) : activeTab === "investments" ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">Asset Breakdown</CardTitle>
            <Link href="/investments">
              <Button size="sm" variant="outline">
                <TrendingUp className="w-4 h-4 mr-1" />
                Open Full
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-border/40 p-2">
                <p className="text-muted-foreground">MF</p>
                <p className="font-semibold">{formatCurrency(assetBreakdown.mf, "INR", true)}</p>
              </div>
              <div className="rounded-xl border border-border/40 p-2">
                <p className="text-muted-foreground">Stocks</p>
                <p className="font-semibold">{formatCurrency(assetBreakdown.stocks, "INR", true)}</p>
              </div>
              <div className="rounded-xl border border-border/40 p-2">
                <p className="text-muted-foreground">SIP</p>
                <p className="font-semibold">{formatCurrency(assetBreakdown.sip, "INR", true)}</p>
              </div>
              <div className="rounded-xl border border-border/40 p-2">
                <p className="text-muted-foreground">Committee</p>
                <p className="font-semibold">{formatCurrency(assetBreakdown.committee, "INR", true)}</p>
              </div>
              <div className="rounded-xl border border-border/40 p-2">
                <p className="text-muted-foreground">FD</p>
                <p className="font-semibold">{formatCurrency(assetBreakdown.fd, "INR", true)}</p>
              </div>
            </div>
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : investmentTotals.rows.length === 0 ? (
              <p className="text-xs text-muted-foreground">No investments yet.</p>
            ) : (
              investmentTotals.rows.slice(0, 20).map((row) => (
                <div key={row.id} className="rounded-xl border border-border/40 p-2 flex items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{row.name}</p>
                    <p className="text-muted-foreground">
                      {row.symbol} · Qty {toDecimal(row.quantity)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold">{formatCurrency(row.value, "INR", true)}</p>
                    <p className={row.gain >= 0 ? "text-success" : "text-destructive"}>
                      {formatPercent(row.invested > 0 ? (row.gain / row.invested) * 100 : 0)}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      ) : activeTab === "liabilities" ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">Liability List</CardTitle>
            <Button size="sm" onClick={() => setShowAddLiability(true)}>
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <p className="text-xs text-muted-foreground">Loading...</p>
            ) : liabilities.length === 0 ? (
              <p className="text-xs text-muted-foreground">No liabilities yet. Add your car/bike/phone or loans.</p>
            ) : (
              liabilities.map((row) => (
                <div key={row.id} className="rounded-xl border border-border/40 p-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-medium truncate">{row.name}</p>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openEditLiability(row)}
                        className="text-primary/80 hover:text-primary"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => removeLiability(row.id)}
                        className="text-destructive/70 hover:text-destructive"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <p className="text-muted-foreground">
                    {row.type} · {new Date(row.startDate).toLocaleDateString("en-IN")}
                  </p>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <div>
                      <p className="text-muted-foreground">Outstanding</p>
                      <p className="font-semibold">{formatCurrency(toDecimal(row.outstanding), "INR", true)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Rate</p>
                      <p className="font-semibold">{toDecimal(row.interestRate)}%</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">EMI</p>
                      <p className="font-semibold">{formatCurrency(toDecimal(row.emiAmount), "INR", true)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Principal</p>
                      <p className="font-semibold">{formatCurrency(toDecimal(row.principal), "INR", true)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
            <div className="rounded-xl border border-border/40 p-2 text-xs">
              <p className="text-muted-foreground">Credit Card Expense / Due</p>
              <p className="font-semibold text-destructive">
                {formatCurrency(liabilityTotals.creditCardExpense, "INR", true)}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <Brain className="w-4 h-4" />
                AI Recommendation
              </CardTitle>
              <Link href="/analytics">
                <Button size="sm" variant="outline">Open Analytics</Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-2 text-xs">
              {ai ? (
                <>
                  <p>{ai.summary}</p>
                  {(ai.suggestions || []).slice(0, 3).map((item) => (
                    <p key={item} className="text-muted-foreground">- {item}</p>
                  ))}
                </>
              ) : (
                <p className="text-muted-foreground">AI recommendation unavailable right now.</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-1.5">
                <ReceiptText className="w-4 h-4" />
                Tax
              </CardTitle>
              <Link href="/tax-center">
                <Button size="sm" variant="outline">Open Tax Center</Button>
              </Link>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-xl border border-border/40 p-2">
                <p className="text-muted-foreground">STCG Est.</p>
                <p className="font-semibold">{formatCurrency(tax?.totals?.stcgTaxEstimate || 0, "INR", true)}</p>
              </div>
              <div className="rounded-xl border border-border/40 p-2">
                <p className="text-muted-foreground">LTCG Est.</p>
                <p className="font-semibold">{formatCurrency(tax?.totals?.ltcgTaxEstimate || 0, "INR", true)}</p>
              </div>
              <div className="rounded-xl border border-border/40 p-2 col-span-2">
                <p className="text-muted-foreground">Total Tax Estimate</p>
                <p className="font-semibold">{formatCurrency(tax?.totals?.totalEstimatedTax || 0, "INR", true)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-3 text-xs text-muted-foreground flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          Other important things remain available in dedicated pages: Rebalance, Goal Investing, Notifications, Budgets, and full Investments.
        </CardContent>
      </Card>

      <Modal open={showAddLiability} onClose={() => setShowAddLiability(false)} title="Add Liability">
        <div className="space-y-3">
          <Input
            label="Name"
            placeholder="e.g., Car Loan"
            value={liabilityForm.name}
            onChange={(e) => setLiabilityForm((p) => ({ ...p, name: e.target.value }))}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <select
              value={liabilityForm.type}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, type: e.target.value }))}
              className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
            >
              <option value="vehicle">Vehicle</option>
              <option value="phone">Phone</option>
              <option value="personal_loan">Personal Loan</option>
              <option value="education">Education</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Principal"
              type="number"
              value={liabilityForm.principal}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, principal: e.target.value }))}
            />
            <Input
              label="Outstanding"
              type="number"
              value={liabilityForm.outstanding}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, outstanding: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Interest Rate %"
              type="number"
              value={liabilityForm.interestRate}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, interestRate: e.target.value }))}
            />
            <Input
              label="EMI (optional)"
              type="number"
              value={liabilityForm.emiAmount}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, emiAmount: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Start Date"
              type="date"
              value={liabilityForm.startDate}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, startDate: e.target.value }))}
            />
            <Input
              label="End Date (optional)"
              type="date"
              value={liabilityForm.endDate}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, endDate: e.target.value }))}
            />
          </div>
          <Button onClick={addLiability} className="w-full" disabled={!liabilityForm.name || !liabilityForm.principal || !liabilityForm.interestRate}>
            Add Liability
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!editLiabilityId}
        onClose={() => {
          setEditLiabilityId(null);
          resetLiabilityForm();
        }}
        title="Edit Liability"
      >
        <div className="space-y-3">
          <Input
            label="Name"
            value={liabilityForm.name}
            onChange={(e) => setLiabilityForm((p) => ({ ...p, name: e.target.value }))}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <select
              value={liabilityForm.type}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, type: e.target.value }))}
              className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
            >
              <option value="vehicle">Vehicle</option>
              <option value="phone">Phone</option>
              <option value="personal_loan">Personal Loan</option>
              <option value="education">Education</option>
              <option value="other">Other</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Principal"
              type="number"
              value={liabilityForm.principal}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, principal: e.target.value }))}
            />
            <Input
              label="Outstanding"
              type="number"
              value={liabilityForm.outstanding}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, outstanding: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Interest Rate %"
              type="number"
              value={liabilityForm.interestRate}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, interestRate: e.target.value }))}
            />
            <Input
              label="EMI (optional)"
              type="number"
              value={liabilityForm.emiAmount}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, emiAmount: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Start Date"
              type="date"
              value={liabilityForm.startDate}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, startDate: e.target.value }))}
            />
            <Input
              label="End Date (optional)"
              type="date"
              value={liabilityForm.endDate}
              onChange={(e) => setLiabilityForm((p) => ({ ...p, endDate: e.target.value }))}
            />
          </div>
          <Button onClick={updateLiability} className="w-full" disabled={!liabilityForm.name || !liabilityForm.principal || !liabilityForm.interestRate}>
            Update Liability
          </Button>
        </div>
      </Modal>
    </div>
  );
}

