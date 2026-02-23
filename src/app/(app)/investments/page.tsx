"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { DonutChart } from "@/components/charts/donut-chart";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatPercent, toDecimal } from "@/lib/utils";
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

const TYPE_COLORS: Record<string, string> = {
  stock: "#3b82f6",
  etf: "#8b5cf6",
  crypto: "#f97316",
  mutual_fund: "#22c55e",
};

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchResults, setSearchResults] = useState<{ symbol: string; name: string; type: string }[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
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
  };

  useEffect(() => {
    fetchInvestments();
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
    setRefreshing(true);
    for (const inv of investments) {
      const res = await fetch(`/api/market-data?symbol=${inv.symbol}`);
      if (res.ok) {
        const quote = await res.json();
        await fetch(`/api/investments/${inv.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentPrice: quote.price, lastUpdated: new Date().toISOString() }),
        });
      }
    }
    await fetchInvestments();
    setRefreshing(false);
    toast.success("Prices updated");
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/investments/${id}`, { method: "DELETE" });
    fetchInvestments();
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
                  <p className="text-2xl font-bold">{formatCurrency(totalValue)}</p>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-semibold ${totalGain >= 0 ? "text-success" : "text-destructive"}`}
                  >
                    {formatCurrency(totalGain)}
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
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs text-white"
                          style={{ backgroundColor: TYPE_COLORS[inv.type] || "#6b7280" }}
                        >
                          {inv.symbol.slice(0, 3)}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{inv.name}</p>
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">{inv.symbol}</span>
                            <Badge variant="secondary">{inv.type}</Badge>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {formatCurrency(inv.value)}
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
    </div>
  );
}
