"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowUpRight,
  Bell,
  Calendar,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate, formatDateShort, nowDateInputValueIST, toDecimal } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { toast } from "sonner";

type InstallmentStatus = "due" | "paid" | "skipped" | "missed";

interface SIPInstallment {
  id: string;
  dueDate: string;
  status: InstallmentStatus;
  amount: string;
  navOrPrice: string | null;
  units: string | null;
  isManual: boolean;
  note: string | null;
  createdAt: string;
}

interface SIPChangeLog {
  id: string;
  action: string;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  note: string | null;
  createdAt: string;
}

interface SIP {
  id: string;
  name: string;
  fundName: string;
  symbol: string | null;
  pricingSource: "market" | "mf_nav";
  schemeCode: string | null;
  schemeName: string | null;
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
  linkedInvestmentId: string | null;
  installments: SIPInstallment[];
  changeLogs: SIPChangeLog[];
}

interface SearchResult {
  symbol?: string;
  name?: string;
  type?: string;
  schemeCode?: string;
  schemeName?: string;
}

export default function SIPsPage() {
  const {
    fc: formatCurrency,
    fcr: formatCurrencyRange,
    fdr: formatDecimalRange,
    fpr: formatPercentRange,
  } = useFormat();
  const [sips, setSips] = useState<SIP[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [refreshingLive, setRefreshingLive] = useState(false);
  const [showUpdate, setShowUpdate] = useState<SIP | null>(null);
  const [showDetails, setShowDetails] = useState<SIP | null>(null);
  const [details, setDetails] = useState<SIP | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [updateForm, setUpdateForm] = useState({ totalInvested: "", currentValue: "", units: "" });
  const [manualInstallmentForm, setManualInstallmentForm] = useState({
    dueDate: nowDateInputValueIST(),
    status: "paid" as InstallmentStatus,
    amount: "",
    navOrPrice: "",
    units: "",
    note: "",
  });
  const [detailInstallmentForm, setDetailInstallmentForm] = useState({
    dueDate: nowDateInputValueIST(),
    status: "paid" as InstallmentStatus,
    amount: "",
    navOrPrice: "",
    units: "",
    note: "",
  });
  const [manualInstallments, setManualInstallments] = useState<
    Array<{
      dueDate: string;
      status: InstallmentStatus;
      amount: string;
      navOrPrice: string;
      units: string;
      note: string;
    }>
  >([]);
  const [form, setForm] = useState({
    name: "",
    fundName: "",
    pricingSource: "mf_nav" as "market" | "mf_nav",
    symbol: "",
    schemeCode: "",
    schemeName: "",
    amount: "",
    sipDate: "1",
    startDate: nowDateInputValueIST(),
    expectedReturn: "12",
  });
  const autoRefreshRef = useRef(false);

  const fetchSips = useCallback(async () => {
    const res = await fetch("/api/sips");
    const data = await res.json();
    setSips(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchSips();
    const timer = setInterval(async () => {
      if (autoRefreshRef.current) return;
      autoRefreshRef.current = true;
      await fetch("/api/sips/refresh", { method: "POST" }).catch(() => null);
      await fetchSips();
      autoRefreshRef.current = false;
    }, 15 * 1000);
    return () => clearInterval(timer);
  }, [fetchSips]);

  const refreshDetails = useCallback(async (id: string) => {
    setDetailLoading(true);
    const res = await fetch(`/api/sips/${id}/details`);
    const data = await res.json();
    if (res.ok) setDetails(data);
    setDetailLoading(false);
  }, []);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const endpoint =
      form.pricingSource === "mf_nav"
        ? `/api/mf/search?q=${encodeURIComponent(q)}`
        : `/api/market-data?q=${encodeURIComponent(q)}`;
    const res = await fetch(endpoint);
    const data = await res.json();
    setSearchResults(data || []);
    setSearchLoading(false);
  };

  const selectSymbol = (result: SearchResult) => {
    if (form.pricingSource === "mf_nav") {
      const schemeCode = String(result.schemeCode || "").trim();
      const schemeName = String(result.schemeName || result.name || "").trim();
      setForm((p) => ({
        ...p,
        schemeCode,
        schemeName,
        fundName: p.fundName || schemeName,
        name: p.name || schemeName,
      }));
    } else {
      const symbol = String(result.symbol || "").trim();
      const name = String(result.name || "").trim();
      setForm((p) => ({
        ...p,
        symbol,
        fundName: p.fundName || name,
        name: p.name || name,
      }));
    }
    setSearchResults([]);
    setSearchQuery("");
  };

  const addManualInstallment = () => {
    if (!manualInstallmentForm.amount || !manualInstallmentForm.dueDate) return;
    setManualInstallments((prev) => [
      ...prev,
      { ...manualInstallmentForm },
    ]);
    setManualInstallmentForm((p) => ({ ...p, amount: "", navOrPrice: "", units: "", note: "" }));
  };

  const handleAdd = async () => {
    if (!form.name || !form.fundName || !form.amount) return;
    const payload = {
      name: form.name,
      fundName: form.fundName,
      pricingSource: form.pricingSource,
      symbol: form.pricingSource === "market" ? form.symbol || undefined : undefined,
      schemeCode: form.pricingSource === "mf_nav" ? form.schemeCode || undefined : undefined,
      schemeName: form.pricingSource === "mf_nav" ? form.schemeName || undefined : undefined,
      amount: parseFloat(form.amount),
      sipDate: parseInt(form.sipDate),
      startDate: form.startDate,
      expectedReturn: parseFloat(form.expectedReturn || "12"),
      installments: manualInstallments.map((item) => ({
        dueDate: item.dueDate,
        status: item.status,
        amount: parseFloat(item.amount),
        navOrPrice: item.navOrPrice ? parseFloat(item.navOrPrice) : undefined,
        units: item.units ? parseFloat(item.units) : undefined,
        note: item.note || undefined,
      })),
    };

    const res = await fetch("/api/sips", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error || "Could not add SIP");
      return;
    }
    setShowAdd(false);
    setManualInstallments([]);
    setForm({
      name: "",
      fundName: "",
      pricingSource: "mf_nav",
      symbol: "",
      schemeCode: "",
      schemeName: "",
      amount: "",
      sipDate: "1",
      startDate: nowDateInputValueIST(),
      expectedReturn: "12",
    });
    fetchSips();
    toast.success("SIP added with manual history");
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
          `Updated ${data.priceUpdated ?? 0}, posted ${data.installmentsPosted ?? 0}, skipped ${data.skipped ?? 0}`
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
    toast.success("SIP marked closed");
  };

  const migrateToInvestment = async (sip: SIP) => {
    const res = await fetch(`/api/sips/${sip.id}/migrate-to-investment`, { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      toast.error(data.error || "Migration failed");
      return;
    }
    toast.success(data.message || "Migrated to MF holding");
    await fetchSips();
  };

  const openDetails = async (sip: SIP) => {
    setShowDetails(sip);
    await refreshDetails(sip.id);
  };

  const addDetailInstallment = async () => {
    if (!showDetails || !detailInstallmentForm.amount) return;
    const res = await fetch(`/api/sips/${showDetails.id}/installments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dueDate: detailInstallmentForm.dueDate,
        status: detailInstallmentForm.status,
        amount: parseFloat(detailInstallmentForm.amount),
        navOrPrice: detailInstallmentForm.navOrPrice ? parseFloat(detailInstallmentForm.navOrPrice) : undefined,
        units: detailInstallmentForm.units ? parseFloat(detailInstallmentForm.units) : undefined,
        note: detailInstallmentForm.note || undefined,
      }),
    });
    if (!res.ok) {
      const payload = await res.json().catch(() => ({}));
      toast.error(payload?.error || "Failed to add installment");
      return;
    }
    setDetailInstallmentForm((p) => ({ ...p, amount: "", navOrPrice: "", units: "", note: "" }));
    await refreshDetails(showDetails.id);
    await fetchSips();
  };

  const markInstallmentStatus = async (installmentId: string, status: InstallmentStatus) => {
    if (!showDetails) return;
    await fetch(`/api/sips/${showDetails.id}/installments`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ installmentId, status }),
    });
    await refreshDetails(showDetails.id);
    await fetchSips();
  };

  const activeSips = useMemo(() => sips.filter((s) => s.status === "active"), [sips]);
  const totalInvested = useMemo(() => sips.reduce((sum, s) => sum + toDecimal(s.totalInvested), 0), [sips]);
  const totalCurrent = useMemo(() => sips.reduce((sum, s) => sum + toDecimal(s.currentValue), 0), [sips]);
  const totalGain = totalCurrent - totalInvested;
  const totalGainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;
  const monthlyTotal = activeSips.reduce((sum, p) => sum + toDecimal(p.amount), 0);

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

  const today = new Date();
  const currentDay = today.getDate();
  const upcomingSips = activeSips
    .map((sip) => {
      const sipDay = sip.sipDate;
      const daysUntil = sipDay >= currentDay ? sipDay - currentDay : 30 - currentDay + sipDay;
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
          description="Start tracking your SIP lifecycle with paid/skipped history"
          action={
            <Button onClick={() => setShowAdd(true)} size="sm">
              Add SIP
            </Button>
          }
        />
      ) : (
        <>
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
                  {totalGain >= 0 ? "+" : ""}
                  {formatCurrency(totalGain, "INR", true)} ({formatPercentRange(totalGainPercent)})
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

          {upcomingSips.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5" /> Upcoming Debits
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {upcomingSips.slice(0, 4).map((sip) => (
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

          <AnimatePresence>
            <div className="space-y-3">
              {sips.map((sip) => {
                const invested = toDecimal(sip.totalInvested);
                const current = toDecimal(sip.currentValue);
                const gain = current - invested;
                const gainPercent = invested > 0 ? (gain / invested) * 100 : 0;
                const monthsActive = Math.max(
                  1,
                  Math.round((Date.now() - new Date(sip.startDate).getTime()) / (30 * 86400000))
                );
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
                              <p className="text-[10px] text-primary/80 truncate">
                                {sip.pricingSource === "mf_nav"
                                  ? sip.schemeCode || "Scheme mapping pending"
                                  : sip.symbol || "Symbol pending"}
                              </p>
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
                              {formatPercentRange(gainPercent)}
                            </p>
                          </div>
                        </div>

                        {invested > 0 && expectedTotal > 0 && (
                          <div className="mb-3">
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                              <span>Invested vs Expected</span>
                              <span>
                                {formatCurrency(invested, "INR", true)} / {formatCurrency(expectedTotal, "INR", true)}
                              </span>
                            </div>
                            <Progress value={invested} max={expectedTotal} size="sm" />
                          </div>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
                          <span>{formatCurrencyRange(toDecimal(sip.amount))}/mo on Day {sip.sipDate}</span>
                          <span>
                            {sip.lastUpdated
                              ? `Valuation as of ${formatDateShort(sip.lastUpdated)}`
                              : `${formatDecimalRange(toDecimal(sip.expectedReturn))}% expected`}
                          </span>
                        </div>

                        <div className="flex gap-2 mt-3 flex-wrap">
                          <button
                            onClick={() => {
                              setShowUpdate(sip);
                              setUpdateForm({
                                totalInvested: toDecimal(sip.totalInvested).toString(),
                                currentValue: toDecimal(sip.currentValue).toString(),
                                units: toDecimal(sip.units).toString(),
                              });
                            }}
                            className="flex-1 min-w-24 flex items-center justify-center gap-1 py-2 rounded-xl bg-muted text-xs font-medium"
                          >
                            <Pencil className="w-3 h-3" /> Update
                          </button>
                          <button
                            onClick={() => openDetails(sip)}
                            className="flex-1 min-w-24 flex items-center justify-center gap-1 py-2 rounded-xl bg-muted text-xs font-medium"
                          >
                            Details
                          </button>
                          <button
                            onClick={() => toggleStatus(sip)}
                            className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-muted text-xs font-medium"
                          >
                            {sip.status === "active" ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                          </button>
                          {toDecimal(sip.units) > 0 && sip.status !== "migrated" && (
                            <button
                              onClick={() => migrateToInvestment(sip)}
                              className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-muted text-xs font-medium"
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

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add SIP">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Data source</label>
            <select
              value={form.pricingSource}
              onChange={(e) =>
                setForm((p) => ({
                  ...p,
                  pricingSource: e.target.value as "market" | "mf_nav",
                  symbol: "",
                  schemeCode: "",
                  schemeName: "",
                }))
              }
              className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
            >
              <option value="mf_nav">Mutual Fund NAV (AMFI)</option>
              <option value="market">Market symbol (Stock/ETF)</option>
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              placeholder={form.pricingSource === "mf_nav" ? "Search MF scheme..." : "Search market symbol..."}
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full h-11 pl-9 pr-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {searchLoading && (
              <p className="text-[10px] text-muted-foreground mt-1">Searching...</p>
            )}
            {searchResults.length > 0 && (
              <div className="absolute top-full mt-1 w-full bg-card border border-border rounded-xl shadow-lg z-10 max-h-48 overflow-auto">
                {searchResults.map((r) => {
                  const key = r.schemeCode || r.symbol || Math.random().toString(36);
                  const title = r.schemeName || r.name || r.symbol || "—";
                  const sub = r.schemeCode || r.symbol || "";
                  return (
                    <button
                      key={key}
                      onClick={() => selectSymbol(r)}
                      className="w-full text-left px-3 py-2 hover:bg-muted text-sm"
                    >
                      <span className="font-medium">{title}</span>
                      <span className="text-muted-foreground ml-2">{sub}</span>
                    </button>
                  );
                })}
              </div>
            )}
            {!searchLoading && searchQuery.length >= 2 && searchResults.length === 0 && (
              <p className="text-[10px] text-muted-foreground mt-1">No results found.</p>
            )}
          </div>
          <Input
            label="SIP Name"
            placeholder="e.g., Midcap Growth SIP"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Input
            label="Fund Name"
            placeholder="e.g., Nippon India Growth Fund"
            value={form.fundName}
            onChange={(e) => setForm((p) => ({ ...p, fundName: e.target.value }))}
          />
          {form.pricingSource === "mf_nav" ? (
            <Input
              label="Scheme Code"
              value={form.schemeCode}
              onChange={(e) => setForm((p) => ({ ...p, schemeCode: e.target.value }))}
            />
          ) : (
            <Input
              label="Market Symbol"
              placeholder="e.g., NIFTYBEES.NS"
              value={form.symbol}
              onChange={(e) => setForm((p) => ({ ...p, symbol: e.target.value.toUpperCase() }))}
            />
          )}
          <Input
            label="Monthly Amount"
            type="number"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            inputMode="decimal"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="SIP Date (day)"
              type="number"
              value={form.sipDate}
              onChange={(e) => setForm((p) => ({ ...p, sipDate: e.target.value }))}
            />
            <Input
              label="Start Date"
              type="date"
              value={form.startDate}
              onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
            />
          </div>
          <Input
            label="Expected Annual Return (%)"
            type="number"
            value={form.expectedReturn}
            onChange={(e) => setForm((p) => ({ ...p, expectedReturn: e.target.value }))}
            inputMode="decimal"
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Manual installment history</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="Due Date"
                  type="date"
                  value={manualInstallmentForm.dueDate}
                  onChange={(e) => setManualInstallmentForm((p) => ({ ...p, dueDate: e.target.value }))}
                />
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={manualInstallmentForm.status}
                    onChange={(e) =>
                      setManualInstallmentForm((p) => ({ ...p, status: e.target.value as InstallmentStatus }))
                    }
                    className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                  >
                    <option value="paid">Paid</option>
                    <option value="skipped">Skipped</option>
                    <option value="missed">Missed</option>
                    <option value="due">Due</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label="Amount"
                  type="number"
                  value={manualInstallmentForm.amount}
                  onChange={(e) => setManualInstallmentForm((p) => ({ ...p, amount: e.target.value }))}
                />
                <Input
                  label="NAV/Price"
                  type="number"
                  value={manualInstallmentForm.navOrPrice}
                  onChange={(e) => setManualInstallmentForm((p) => ({ ...p, navOrPrice: e.target.value }))}
                />
                <Input
                  label="Units"
                  type="number"
                  value={manualInstallmentForm.units}
                  onChange={(e) => setManualInstallmentForm((p) => ({ ...p, units: e.target.value }))}
                />
              </div>
              <Input
                label="Note"
                value={manualInstallmentForm.note}
                onChange={(e) => setManualInstallmentForm((p) => ({ ...p, note: e.target.value }))}
              />
              <Button variant="outline" onClick={addManualInstallment} className="w-full">
                Add installment row
              </Button>
              {manualInstallments.length > 0 && (
                <div className="space-y-1 max-h-40 overflow-auto">
                  {manualInstallments.map((item, idx) => (
                    <div key={`${item.dueDate}-${idx}`} className="text-xs border rounded-lg px-2 py-1 flex justify-between">
                      <span>{formatDate(item.dueDate)} · {item.status}</span>
                      <span>{item.amount}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
          <Button onClick={handleAdd} className="w-full" disabled={!form.name || !form.fundName || !form.amount}>
            Add SIP with details
          </Button>
        </div>
      </Modal>

      <Modal open={!!showUpdate} onClose={() => setShowUpdate(null)} title="Update SIP Values">
        <div className="space-y-4">
          {showUpdate && (
            <p className="text-sm text-muted-foreground">
              {showUpdate.name} — {showUpdate.fundName}
            </p>
          )}
          <Input
            label="Total Invested"
            type="number"
            value={updateForm.totalInvested}
            onChange={(e) => setUpdateForm((p) => ({ ...p, totalInvested: e.target.value }))}
            inputMode="decimal"
          />
          <Input
            label="Current Value"
            type="number"
            value={updateForm.currentValue}
            onChange={(e) => setUpdateForm((p) => ({ ...p, currentValue: e.target.value }))}
            inputMode="decimal"
          />
          <Input
            label="Total Units"
            type="number"
            value={updateForm.units}
            onChange={(e) => setUpdateForm((p) => ({ ...p, units: e.target.value }))}
            inputMode="decimal"
          />
          <Button onClick={handleUpdateValues} className="w-full">
            Update Values
          </Button>
        </div>
      </Modal>

      <Modal open={!!showDetails} onClose={() => setShowDetails(null)} title={showDetails ? `${showDetails.name} details` : "SIP details"}>
        {!showDetails || detailLoading || !details ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Invested</p>
                  <p className="font-semibold">{formatCurrency(toDecimal(details.totalInvested))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Current</p>
                  <p className="font-semibold">{formatCurrency(toDecimal(details.currentValue))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Units</p>
                  <p className="font-semibold">{formatDecimalRange(toDecimal(details.units))}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Return</p>
                  <p className="font-semibold">
                    {formatPercentRange(
                      toDecimal(details.totalInvested) > 0
                        ? ((toDecimal(details.currentValue) - toDecimal(details.totalInvested)) /
                            toDecimal(details.totalInvested)) *
                            100
                        : 0
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Installment timeline</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-56 overflow-auto">
                {details.installments.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No installment entries yet.</p>
                ) : (
                  details.installments.map((row) => (
                    <div key={row.id} className="border rounded-lg p-2 text-xs">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">{formatDate(row.dueDate)}</p>
                        <Badge variant="secondary">{row.status}</Badge>
                      </div>
                      <p className="text-muted-foreground">
                        Amount {formatCurrency(toDecimal(row.amount))} · NAV/Price{" "}
                        {row.navOrPrice ? formatDecimalRange(toDecimal(row.navOrPrice)) : "—"} · Units{" "}
                        {row.units ? formatDecimalRange(toDecimal(row.units)) : "—"}
                      </p>
                      <div className="flex gap-1 mt-1">
                        {(["paid", "skipped", "missed", "due"] as InstallmentStatus[]).map((status) => (
                          <button
                            key={status}
                            className="px-2 py-1 rounded bg-muted capitalize"
                            onClick={() => markInstallmentStatus(row.id, status)}
                          >
                            {status}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Add installment</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    label="Date"
                    type="date"
                    value={detailInstallmentForm.dueDate}
                    onChange={(e) => setDetailInstallmentForm((p) => ({ ...p, dueDate: e.target.value }))}
                  />
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Status</label>
                    <select
                      value={detailInstallmentForm.status}
                      onChange={(e) =>
                        setDetailInstallmentForm((p) => ({ ...p, status: e.target.value as InstallmentStatus }))
                      }
                      className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm"
                    >
                      <option value="paid">Paid</option>
                      <option value="skipped">Skipped</option>
                      <option value="missed">Missed</option>
                      <option value="due">Due</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    label="Amount"
                    type="number"
                    value={detailInstallmentForm.amount}
                    onChange={(e) => setDetailInstallmentForm((p) => ({ ...p, amount: e.target.value }))}
                  />
                  <Input
                    label="NAV/Price"
                    type="number"
                    value={detailInstallmentForm.navOrPrice}
                    onChange={(e) => setDetailInstallmentForm((p) => ({ ...p, navOrPrice: e.target.value }))}
                  />
                  <Input
                    label="Units"
                    type="number"
                    value={detailInstallmentForm.units}
                    onChange={(e) => setDetailInstallmentForm((p) => ({ ...p, units: e.target.value }))}
                  />
                </div>
                <Input
                  label="Note"
                  value={detailInstallmentForm.note}
                  onChange={(e) => setDetailInstallmentForm((p) => ({ ...p, note: e.target.value }))}
                />
                <Button onClick={addDetailInstallment} className="w-full">
                  Add installment
                </Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Edit history</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-40 overflow-auto">
                {details.changeLogs.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No change history yet.</p>
                ) : (
                  details.changeLogs.map((row) => (
                    <div key={row.id} className="text-xs border rounded-lg px-2 py-1">
                      <p className="font-medium capitalize">{row.action.replaceAll("_", " ")}</p>
                      <p className="text-muted-foreground">
                        {row.field ? `${row.field}: ${row.fromValue || "—"} → ${row.toValue || "—"}` : row.note || "—"}
                      </p>
                      <p className="text-muted-foreground">{formatDate(row.createdAt)}</p>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}
