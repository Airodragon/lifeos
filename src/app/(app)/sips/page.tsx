"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  Plus,
  Calendar,
  IndianRupee,
  Pause,
  Play,
  Trash2,
  Pencil,
  Bell,
  ArrowUpRight,
  RefreshCw,
  Search,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toDecimal } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { toast } from "sonner";

interface SIP {
  id: string;
  name: string;
  fundName: string;
  symbol: string | null;
  amount: string;
  frequency: string;
  sipDate: number;
  startDate: string;
  endDate: string | null;
  totalInvested: string;
  currentValue: string;
  units: string;
  expectedReturn: string;
  status: string;
  lastDebitDate: string | null;
  lastPrice: string | null;
  lastUpdated: string | null;
}

export default function SIPsPage() {
  const { fc: formatCurrency, fp: formatPercent } = useFormat();
  const [sips, setSips] = useState<SIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshingLive, setRefreshingLive] = useState(false);
  const [showUpdate, setShowUpdate] = useState<SIP | null>(null);
  const [searchResults, setSearchResults] = useState<
    { symbol: string; name: string; type: string }[]
  >([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [updateForm, setUpdateForm] = useState({ totalInvested: "", currentValue: "", units: "" });
  const [form, setForm] = useState({
    name: "",
    fundName: "",
    symbol: "",
    amount: "",
    sipDate: "1",
    startDate: new Date().toISOString().split("T")[0],
    expectedReturn: "12",
    totalInvested: "",
    currentValue: "",
  });

  const fetchSips = useCallback(async () => {
    const res = await fetch("/api/sips");
    const data = await res.json();
    setSips(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSips();
    const timer = setInterval(() => {
      fetch("/api/sips/refresh", { method: "POST" })
        .then(() => fetchSips())
        .catch(() => {});
    }, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [fetchSips]);

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

  const selectSymbol = (result: { symbol: string; name: string }) => {
    setForm((p) => ({
      ...p,
      symbol: result.symbol,
      fundName: p.fundName || result.name,
      name: p.name || result.name,
    }));
    setSearchResults([]);
    setSearchQuery("");
  };

  const handleAdd = async () => {
    if (!form.name || !form.fundName || !form.amount) return;
    await fetch("/api/sips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        fundName: form.fundName,
        symbol: form.symbol || undefined,
        amount: parseFloat(form.amount),
        sipDate: parseInt(form.sipDate),
        startDate: form.startDate,
        expectedReturn: parseFloat(form.expectedReturn || "12"),
        totalInvested: form.totalInvested ? parseFloat(form.totalInvested) : 0,
        currentValue: form.currentValue ? parseFloat(form.currentValue) : 0,
      }),
    });
    setShowAdd(false);
    setForm({ name: "", fundName: "", symbol: "", amount: "", sipDate: "1", startDate: new Date().toISOString().split("T")[0], expectedReturn: "12", totalInvested: "", currentValue: "" });
    fetchSips();
    toast.success("SIP added");
  };

  const handleRefreshLive = async () => {
    setRefreshingLive(true);
    try {
      const res = await fetch("/api/sips/refresh", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Live refresh failed");
      } else {
        toast.success(
          `Prices updated: ${data.priceUpdated ?? 0}, installments posted: ${data.installmentsPosted ?? 0}`
        );
        await fetchSips();
      }
    } finally {
      setRefreshingLive(false);
    }
  };

  const handleUpdateValues = async () => {
    if (!showUpdate) return;
    await fetch(`/api/sips/${showUpdate.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        totalInvested: parseFloat(updateForm.totalInvested || "0"),
        currentValue: parseFloat(updateForm.currentValue || "0"),
        units: parseFloat(updateForm.units || "0"),
        lastDebitDate: new Date().toISOString(),
      }),
    });
    setShowUpdate(null);
    fetchSips();
    toast.success("SIP updated");
  };

  const toggleStatus = async (sip: SIP) => {
    const newStatus = sip.status === "active" ? "paused" : "active";
    await fetch(`/api/sips/${sip.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    fetchSips();
    toast.success(`SIP ${newStatus}`);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/sips/${id}`, { method: "DELETE" });
    fetchSips();
    toast.success("SIP removed");
  };

  const migrateToInvestment = async (sip: SIP) => {
    const res = await fetch(`/api/sips/${sip.id}/migrate-to-investment`, {
      method: "POST",
    });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Migration failed");
      return;
    }
    toast.success(data.message || "Migrated to MF holding");
    await fetchSips();
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-32 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const activeSips = sips.filter((s) => s.status === "active");
  const totalInvested = sips.reduce((s, p) => s + toDecimal(p.totalInvested), 0);
  const totalCurrent = sips.reduce((s, p) => s + toDecimal(p.currentValue), 0);
  const totalGain = totalCurrent - totalInvested;
  const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const monthlyTotal = activeSips.reduce((s, p) => s + toDecimal(p.amount), 0);

  // Next SIP dates
  const today = new Date();
  const currentDay = today.getDate();
  const upcomingSips = activeSips
    .map((sip) => {
      const sipDay = sip.sipDate;
      const daysUntil = sipDay >= currentDay ? sipDay - currentDay : (30 - currentDay + sipDay);
      return { ...sip, daysUntil };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <div className="p-4 space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">SIP Manager</h2>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={handleRefreshLive} disabled={refreshingLive}>
            <RefreshCw className={`w-4 h-4 ${refreshingLive ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="w-4 h-4 mr-1" /> Add SIP
          </Button>
        </div>
      </div>

      {sips.length === 0 ? (
        <EmptyState
          icon={<TrendingUp className="w-10 h-10" />}
          title="No SIPs yet"
          description="Start tracking your Systematic Investment Plans"
          action={<Button onClick={() => setShowAdd(true)} size="sm">Add SIP</Button>}
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground">Total Invested</p>
                <p className="text-base font-bold">{formatCurrency(totalInvested, "INR", true)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground">Current Value</p>
                <p className="text-base font-bold">{formatCurrency(totalCurrent, "INR", true)}</p>
                <p className={`text-[10px] font-medium ${totalGain >= 0 ? "text-success" : "text-destructive"}`}>
                  {totalGain >= 0 ? "+" : ""}{formatCurrency(totalGain, "INR", true)} ({formatPercent(totalGainPercent)})
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">Monthly SIP Total</p>
                <p className="text-lg font-bold">{formatCurrency(monthlyTotal)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">Active SIPs</p>
                <p className="text-lg font-bold">{activeSips.length}</p>
              </div>
            </CardContent>
          </Card>

          {/* Upcoming SIP Dates */}
          {upcomingSips.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" /> Upcoming Debits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {upcomingSips.slice(0, 3).map((sip) => (
                    <div key={sip.id} className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                          <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{sip.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {sip.daysUntil === 0 ? "Today" : `In ${sip.daysUntil} days`} (Day {sip.sipDate})
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-semibold shrink-0">{formatCurrency(toDecimal(sip.amount))}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* SIP List */}
          <AnimatePresence>
            <div className="space-y-3">
              {sips.map((sip) => {
                const invested = toDecimal(sip.totalInvested);
                const current = toDecimal(sip.currentValue);
                const gain = current - invested;
                const gainPercent = invested > 0 ? (gain / invested) * 100 : 0;
                const monthsActive = Math.max(1, Math.round(
                  (Date.now() - new Date(sip.startDate).getTime()) / (30 * 86400000)
                ));
                const expectedMonthly = toDecimal(sip.amount);
                const expectedTotal = expectedMonthly * monthsActive;

                return (
                  <motion.div
                    key={sip.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                  >
                    <Card className={sip.status === "paused" ? "opacity-60" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                              <ArrowUpRight className="w-5 h-5 text-emerald-500" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">{sip.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{sip.fundName}</p>
                              {sip.symbol && (
                                <p className="text-[10px] text-primary/80 truncate">{sip.symbol}</p>
                              )}
                            </div>
                          </div>
                          <Badge variant={sip.status === "active" ? "success" : "secondary"} className="shrink-0">
                            {sip.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center mb-3">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Invested</p>
                            <p className="text-xs font-semibold">{formatCurrency(invested, "INR", true)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Current</p>
                            <p className="text-xs font-semibold">{formatCurrency(current, "INR", true)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Returns</p>
                            <p className={`text-xs font-semibold ${gain >= 0 ? "text-success" : "text-destructive"}`}>
                              {formatPercent(gainPercent)}
                            </p>
                          </div>
                        </div>

                        {invested > 0 && expectedTotal > 0 && (
                          <div className="mb-3">
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                              <span>Invested vs Expected</span>
                              <span>{formatCurrency(invested, "INR", true)} / {formatCurrency(expectedTotal, "INR", true)}</span>
                            </div>
                            <Progress value={invested} max={expectedTotal} size="sm" />
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <IndianRupee className="w-3 h-3" />
                            {formatCurrency(toDecimal(sip.amount))}/mo on Day {sip.sipDate}
                          </span>
                          <span>
                            {sip.lastUpdated
                              ? `Valuation as of ${new Date(sip.lastUpdated).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                              : `${toDecimal(sip.expectedReturn)}% expected`}
                          </span>
                        </div>

                        <div className="flex gap-2 mt-3">
                          <button
                            onClick={() => {
                              setShowUpdate(sip);
                              setUpdateForm({
                                totalInvested: toDecimal(sip.totalInvested).toString(),
                                currentValue: toDecimal(sip.currentValue).toString(),
                                units: toDecimal(sip.units).toString(),
                              });
                            }}
                            className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-muted text-xs font-medium"
                          >
                            <Pencil className="w-3 h-3" /> Update
                          </button>
                          <button
                            onClick={() => toggleStatus(sip)}
                            className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-muted text-xs font-medium"
                          >
                            {sip.status === "active" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                          </button>
                          {sip.symbol && toDecimal(sip.units) > 0 && sip.status !== "migrated" && (
                            <button
                              onClick={() => migrateToInvestment(sip)}
                              className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-muted text-xs font-medium"
                              title="Move this SIP holding to MF portfolio"
                            >
                              Move to MF
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(sip.id)}
                            className="flex items-center justify-center px-3 py-2 rounded-xl text-xs text-destructive/60 hover:text-destructive hover:bg-destructive/5"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </AnimatePresence>
        </>
      )}

      {/* Add SIP Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add SIP">
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder="Search MF/ETF symbol..."
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
          <Input label="SIP Name" placeholder="e.g., Nifty 50 SIP" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input label="Fund Name" placeholder="e.g., Nippon India Nifty 50 BeES" value={form.fundName} onChange={(e) => setForm((p) => ({ ...p, fundName: e.target.value }))} />
          <Input label="Market Symbol (optional for live data)" placeholder="e.g., NIFTYBEES.NS" value={form.symbol} onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value.toUpperCase() }))} />
          <Input label="Monthly Amount" type="number" value={form.amount} onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))} inputMode="decimal" />
          <Input label="SIP Date (day of month)" type="number" value={form.sipDate} onChange={(e) => setForm((p) => ({ ...p, sipDate: e.target.value }))} />
          <Input label="Start Date" type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
          <Input label="Expected Annual Return (%)" type="number" value={form.expectedReturn} onChange={(e) => setForm((p) => ({ ...p, expectedReturn: e.target.value }))} inputMode="decimal" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Already Invested" type="number" placeholder="0" value={form.totalInvested} onChange={(e) => setForm((p) => ({ ...p, totalInvested: e.target.value }))} inputMode="decimal" />
            <Input label="Current Value" type="number" placeholder="0" value={form.currentValue} onChange={(e) => setForm((p) => ({ ...p, currentValue: e.target.value }))} inputMode="decimal" />
          </div>
          <Button onClick={handleAdd} className="w-full" disabled={!form.name || !form.fundName || !form.amount}>
            Add SIP
          </Button>
        </div>
      </Modal>

      {/* Update SIP Modal */}
      <Modal open={!!showUpdate} onClose={() => setShowUpdate(null)} title="Update SIP Values">
        <div className="space-y-4">
          {showUpdate && (
            <p className="text-sm text-muted-foreground">{showUpdate.name} — {showUpdate.fundName}</p>
          )}
          <Input label="Total Invested" type="number" value={updateForm.totalInvested} onChange={(e) => setUpdateForm((p) => ({ ...p, totalInvested: e.target.value }))} inputMode="decimal" />
          <Input label="Current Value" type="number" value={updateForm.currentValue} onChange={(e) => setUpdateForm((p) => ({ ...p, currentValue: e.target.value }))} inputMode="decimal" />
          <Input label="Total Units" type="number" value={updateForm.units} onChange={(e) => setUpdateForm((p) => ({ ...p, units: e.target.value }))} inputMode="decimal" />
          <Button onClick={handleUpdateValues} className="w-full">
            Update Values
          </Button>
        </div>
      </Modal>
    </div>
  );
}
