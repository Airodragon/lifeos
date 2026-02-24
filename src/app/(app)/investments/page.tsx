"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  RefreshCw,
  Search,
  ClipboardList,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { DonutChart } from "@/components/charts/donut-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { toDecimal } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { toast } from "sonner";

interface Investment {
  id: string;
  symbol: string;
  name: string;
  type: string;
  quantity: string;
  avgBuyPrice: string;
  currentPrice: string | null;
  lastUpdated: string | null;
}

interface InvestmentTxn {
  id: string;
  type: "buy" | "sell" | "sip" | "dividend" | "fee";
  quantity: string | null;
  price: string | null;
  amount: string;
  fees: string | null;
  taxes: string | null;
  note: string | null;
  date: string;
}

const TYPE_COLORS: Record<string, string> = {
  stock: "#3b82f6",
  etf: "#8b5cf6",
  crypto: "#f97316",
  mutual_fund: "#22c55e",
};

export default function InvestmentsPage() {
  const {
    fc: formatCurrency,
    fp: formatPercent,
    fic: formatCompactCurrency,
  } = useFormat();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchResults, setSearchResults] = useState<{ symbol: string; name: string; type: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showLedger, setShowLedger] = useState<Investment | null>(null);
  const [ledger, setLedger] = useState<InvestmentTxn[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [txnForm, setTxnForm] = useState({
    type: "buy" as InvestmentTxn["type"],
    quantity: "",
    price: "",
    amount: "",
    fees: "",
    taxes: "",
    note: "",
    date: new Date().toISOString().slice(0, 10),
  });
  const [form, setForm] = useState({
    symbol: "",
    name: "",
    type: "stock" as string,
    quantity: "",
    avgBuyPrice: "",
  });

  const fetchInvestments = async () => {
    const res = await fetch("/api/investments");
    const data = await res.json();
    setInvestments(data || []);
    setLoading(false);
    return data || [];
  };

  const autoRefreshPrices = async (invs: Investment[]) => {
    if (!invs.length) return;
    setRefreshing(true);
    try {
      const res = await fetch("/api/market-data/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbols: invs.map((i) => i.symbol) }),
      });
      if (res.ok) {
        const quotes: Record<string, number> = await res.json();
        const updates = invs
          .filter((inv) => quotes[inv.symbol])
          .map((inv) =>
            fetch(`/api/investments/${inv.id}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ currentPrice: quotes[inv.symbol], lastUpdated: new Date().toISOString() }),
            })
          );
        await Promise.all(updates);
        await fetchInvestments();
      }
    } catch {
      // silent fail for auto-refresh
    }
    setRefreshing(false);
  };

  useEffect(() => {
    fetchInvestments().then((data) => {
      if (data?.length) autoRefreshPrices(data);
    });
    const timer = setInterval(async () => {
      const data = await fetchInvestments();
      if (data?.length) await autoRefreshPrices(data);
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    const res = await fetch(`/api/market-data?q=${encodeURIComponent(q)}`);
    const data = await res.json();
    setSearchResults(data || []);
  };

  const selectSymbol = (result: { symbol: string; name: string; type: string }) => {
    setForm((p) => ({ ...p, symbol: result.symbol, name: result.name }));
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleAdd = async () => {
    if (!form.symbol || !form.quantity || !form.avgBuyPrice) return;
    await fetch("/api/investments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        quantity: parseFloat(form.quantity),
        avgBuyPrice: parseFloat(form.avgBuyPrice),
      }),
    });
    setShowAdd(false);
    setForm({ symbol: "", name: "", type: "stock", quantity: "", avgBuyPrice: "" });
    fetchInvestments();
    toast.success("Investment added");
  };

  const handleRefresh = async () => {
    await autoRefreshPrices(investments);
    toast.success("Prices updated");
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/investments/${id}`, { method: "DELETE" });
    fetchInvestments();
  };

  const openLedger = async (inv: Investment) => {
    setShowLedger(inv);
    setLedgerLoading(true);
    const res = await fetch(`/api/investments/${inv.id}/transactions`);
    const data = await res.json();
    setLedger(data || []);
    setLedgerLoading(false);
  };

  const addLedgerTxn = async () => {
    if (!showLedger) return;
    if (!txnForm.amount) return;
    const payload: Record<string, unknown> = {
      type: txnForm.type,
      amount: parseFloat(txnForm.amount),
      date: txnForm.date,
      note: txnForm.note || undefined,
      fees: txnForm.fees ? parseFloat(txnForm.fees) : undefined,
      taxes: txnForm.taxes ? parseFloat(txnForm.taxes) : undefined,
      quantity: txnForm.quantity ? parseFloat(txnForm.quantity) : undefined,
      price: txnForm.price ? parseFloat(txnForm.price) : undefined,
    };
    const res = await fetch(`/api/investments/${showLedger.id}/transactions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      toast.error("Failed to add transaction");
      return;
    }
    toast.success("Ledger transaction added");
    setTxnForm({
      type: "buy",
      quantity: "",
      price: "",
      amount: "",
      fees: "",
      taxes: "",
      note: "",
      date: new Date().toISOString().slice(0, 10),
    });
    await openLedger(showLedger);
    await fetchInvestments();
  };

  const deleteLedgerTxn = async (id: string) => {
    if (!showLedger) return;
    await fetch(`/api/investments/${showLedger.id}/transactions`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transactionId: id }),
    });
    await openLedger(showLedger);
    await fetchInvestments();
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-48 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const portfolio = investments.map((inv) => {
    const qty = toDecimal(inv.quantity);
    const avg = toDecimal(inv.avgBuyPrice);
    const current = toDecimal(inv.currentPrice) || avg;
    const value = qty * current;
    const invested = qty * avg;
    const gain = value - invested;
    const gainPercent = invested > 0 ? (gain / invested) * 100 : 0;
    return { ...inv, qty, avg, current, value, invested, gain, gainPercent };
  });

  const totalValue = portfolio.reduce((s, p) => s + p.value, 0);
  const totalInvested = portfolio.reduce((s, p) => s + p.invested, 0);
  const totalGain = totalValue - totalInvested;
  const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

  const allocationData = portfolio.map((p) => ({
    name: p.symbol,
    value: p.value,
    color: TYPE_COLORS[p.type] || "#6b7280",
  }));

  const ledgerInvested = ledger
    .filter((t) => t.type === "buy" || t.type === "sip" || t.type === "fee")
    .reduce((s, t) => s + toDecimal(t.amount), 0);
  const ledgerWithdrawn = ledger
    .filter((t) => t.type === "sell" || t.type === "dividend")
    .reduce((s, t) => s + toDecimal(t.amount), 0);
  const ledgerNet = ledgerInvested - ledgerWithdrawn;

  const selectedInv = showLedger
    ? portfolio.find((p) => p.id === showLedger.id)
    : null;
  const currentValueForLedger = selectedInv?.value || 0;

  const calcXirr = () => {
    if (!ledger.length || !currentValueForLedger) return 0;
    const cashflows = ledger
      .map((t) => ({
        date: new Date(t.date),
        amount:
          t.type === "sell" || t.type === "dividend"
            ? toDecimal(t.amount)
            : -toDecimal(t.amount),
      }))
      .concat([{ date: new Date(), amount: currentValueForLedger }]);

    const minDate = cashflows.reduce(
      (min, c) => (c.date < min ? c.date : min),
      cashflows[0].date
    );
    const npv = (rate: number) =>
      cashflows.reduce((sum, cf) => {
        const years = (cf.date.getTime() - minDate.getTime()) / (365.25 * 86400000);
        return sum + cf.amount / Math.pow(1 + rate, years);
      }, 0);
    const dnpv = (rate: number) =>
      cashflows.reduce((sum, cf) => {
        const years = (cf.date.getTime() - minDate.getTime()) / (365.25 * 86400000);
        return sum - (years * cf.amount) / Math.pow(1 + rate, years + 1);
      }, 0);

    let guess = 0.12;
    for (let i = 0; i < 50; i++) {
      const f = npv(guess);
      const df = dnpv(guess);
      if (Math.abs(df) < 1e-10) break;
      const next = guess - f / df;
      if (!Number.isFinite(next)) break;
      if (Math.abs(next - guess) < 1e-8) {
        guess = next;
        break;
      }
      guess = Math.max(-0.99, Math.min(10, next));
    }
    return guess * 100;
  };

  const xirr = calcXirr();

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Portfolio</h2>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      {investments.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="w-10 h-10" />}
          title="No investments yet"
          description="Add your first stock, ETF, or crypto holding"
          action={
            <Button onClick={() => setShowAdd(true)} size="sm">
              Add Investment
            </Button>
          }
        />
      ) : (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Total Value</p>
                  <p className="text-2xl font-bold">{formatCompactCurrency(totalValue, "INR")}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${totalGain >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {formatCompactCurrency(totalGain, "INR")}
                  </p>
                  <p
                    className={`text-xs ${totalGain >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {formatPercent(totalGainPercent)}
                  </p>
                </div>
              </div>
              {allocationData.length > 0 && (
                <DonutChart
                  data={allocationData}
                  innerLabel="Allocation"
                  height={180}
                />
              )}
            </CardContent>
          </Card>

          <div className="space-y-2">
            {portfolio.map((inv) => (
              <motion.div
                key={inv.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-white shrink-0"
                          style={{ backgroundColor: TYPE_COLORS[inv.type] || "#6b7280" }}
                        >
                          {inv.symbol.slice(0, 3)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{inv.name}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground truncate">{inv.symbol}</span>
                            <Badge variant="secondary">{inv.type}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-semibold">
                          {formatCompactCurrency(inv.value, "INR")}
                        </p>
                        <p
                          className={`text-xs ${inv.gain >= 0 ? "text-success" : "text-destructive"}`}
                        >
                          {formatPercent(inv.gainPercent)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
                      <span>Qty: {inv.qty}</span>
                      <span>Avg: {formatCurrency(inv.avg)}</span>
                      <span>LTP: {formatCurrency(inv.current)}</span>
                      <span>
                        {inv.lastUpdated
                          ? `As of ${new Date(inv.lastUpdated).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}`
                          : "As of —"}
                      </span>
                      <button
                        onClick={() => openLedger(inv)}
                        className="text-primary/80 hover:text-primary"
                      >
                        Ledger
                      </button>
                      <button
                        onClick={() => handleDelete(inv.id)}
                        className="text-destructive/60 hover:text-destructive"
                      >
                        Remove
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Investment">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Search symbol..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full h-11 pl-9 pr-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg z-10 max-h-48 overflow-auto">
                {searchResults.map((r) => (
                  <button
                    key={r.symbol}
                    onClick={() => selectSymbol(r)}
                    className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                  >
                    <span className="font-medium">{r.symbol}</span>
                    <span className="text-muted-foreground ml-2">{r.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {form.symbol && (
            <p className="text-sm">
              Selected: <span className="font-medium">{form.symbol}</span> — {form.name}
            </p>
          )}
          <Input
            label="Symbol"
            value={form.symbol}
            onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value.toUpperCase() }))}
            placeholder="RELIANCE.NS"
          />
          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
            >
              <option value="stock">Stock</option>
              <option value="etf">ETF</option>
              <option value="crypto">Crypto</option>
              <option value="mutual_fund">Mutual Fund</option>
            </select>
          </div>
          <Input
            label="Quantity"
            type="number"
            value={form.quantity}
            onChange={(e) => setForm((p) => ({ ...p, quantity: e.target.value }))}
            inputMode="decimal"
          />
          <Input
            label="Average Buy Price"
            type="number"
            value={form.avgBuyPrice}
            onChange={(e) => setForm((p) => ({ ...p, avgBuyPrice: e.target.value }))}
            inputMode="decimal"
          />
          <Button onClick={handleAdd} className="w-full" disabled={!form.symbol || !form.quantity}>
            Add Investment
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!showLedger}
        onClose={() => setShowLedger(null)}
        title={showLedger ? `${showLedger.name} Ledger` : "Investment Ledger"}
      >
        <div className="space-y-4">
          <Card>
            <CardContent className="p-3 grid grid-cols-2 gap-2 text-xs">
              <div>
                <p className="text-muted-foreground">Net Cash Invested</p>
                <p className="font-semibold">{formatCurrency(ledgerNet)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Current Value</p>
                <p className="font-semibold">{formatCurrency(currentValueForLedger)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">XIRR</p>
                <p className={`font-semibold ${xirr >= 0 ? "text-success" : "text-destructive"}`}>
                  {Number.isFinite(xirr) ? `${xirr.toFixed(2)}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">5Y Projection @XIRR</p>
                <p className="font-semibold">
                  {formatCurrency(
                    currentValueForLedger > 0
                      ? currentValueForLedger * Math.pow(1 + Math.max(-0.99, xirr / 100), 5)
                      : 0
                  )}
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Type</label>
              <select
                value={txnForm.type}
                onChange={(e) =>
                  setTxnForm((p) => ({ ...p, type: e.target.value as InvestmentTxn["type"] }))
                }
                className="w-full h-10 rounded-xl border border-input bg-background px-3 text-sm"
              >
                <option value="buy">Buy</option>
                <option value="sell">Sell</option>
                <option value="sip">SIP</option>
                <option value="dividend">Dividend</option>
                <option value="fee">Fee</option>
              </select>
            </div>
            <Input
              label="Date"
              type="date"
              value={txnForm.date}
              onChange={(e) => setTxnForm((p) => ({ ...p, date: e.target.value }))}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Quantity (opt)"
              type="number"
              value={txnForm.quantity}
              onChange={(e) => setTxnForm((p) => ({ ...p, quantity: e.target.value }))}
              inputMode="decimal"
            />
            <Input
              label="Price (opt)"
              type="number"
              value={txnForm.price}
              onChange={(e) => setTxnForm((p) => ({ ...p, price: e.target.value }))}
              inputMode="decimal"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Input
              label="Amount"
              type="number"
              value={txnForm.amount}
              onChange={(e) => setTxnForm((p) => ({ ...p, amount: e.target.value }))}
              inputMode="decimal"
            />
            <Input
              label="Fees"
              type="number"
              value={txnForm.fees}
              onChange={(e) => setTxnForm((p) => ({ ...p, fees: e.target.value }))}
              inputMode="decimal"
            />
            <Input
              label="Taxes"
              type="number"
              value={txnForm.taxes}
              onChange={(e) => setTxnForm((p) => ({ ...p, taxes: e.target.value }))}
              inputMode="decimal"
            />
          </div>
          <Input
            label="Note (optional)"
            value={txnForm.note}
            onChange={(e) => setTxnForm((p) => ({ ...p, note: e.target.value }))}
          />
          <Button onClick={addLedgerTxn} className="w-full" disabled={!txnForm.amount}>
            <ClipboardList className="w-4 h-4 mr-2" />
            Add Ledger Entry
          </Button>

          <div className="space-y-2 max-h-64 overflow-auto">
            {ledgerLoading ? (
              <Skeleton className="h-20 w-full" />
            ) : ledger.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">
                No ledger entries yet.
              </p>
            ) : (
              ledger.map((t) => (
                <div
                  key={t.id}
                  className="rounded-xl border border-border/40 p-2 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium uppercase">{t.type}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(t.date).toLocaleDateString("en-IN")} · {formatCurrency(toDecimal(t.amount))}
                    </p>
                    {t.note && <p className="text-[10px] text-muted-foreground truncate">{t.note}</p>}
                  </div>
                  <button
                    onClick={() => deleteLedgerTxn(t.id)}
                    className="text-destructive/70 hover:text-destructive shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
}
