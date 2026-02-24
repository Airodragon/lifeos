"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Landmark,
  Plus,
  Calendar,
  Percent,
  Clock,
  IndianRupee,
  Trash2,
  RefreshCw,
  CheckCircle2,
  Timer,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate, nowDateInputValueIST, toDateInputValueIST, toDecimal } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { toast } from "sonner";

interface FD {
  id: string;
  bankName: string;
  accountNumber: string | null;
  principal: string;
  interestRate: string;
  compounding: string;
  startDate: string;
  maturityDate: string;
  maturityAmount: string;
  isAutoRenew: boolean;
  notes: string | null;
  status: string;
}

const COMPOUNDING_LABELS: Record<string, string> = {
  monthly: "Monthly",
  quarterly: "Quarterly",
  half_yearly: "Half-Yearly",
  yearly: "Yearly",
};

const COMPOUNDING_N: Record<string, number> = {
  monthly: 12,
  quarterly: 4,
  half_yearly: 2,
  yearly: 1,
};

function calcCurrentValue(principal: number, rate: number, compounding: string, startDate: string): number {
  const start = new Date(startDate);
  const now = new Date();
  const years = Math.max(0, (now.getTime() - start.getTime()) / (365.25 * 86400000));
  const n = COMPOUNDING_N[compounding] || 4;
  const r = rate / 100;
  return principal * Math.pow(1 + r / n, n * years);
}

function daysRemaining(maturityDate: string): number {
  const mat = new Date(maturityDate);
  const now = new Date();
  return Math.max(0, Math.ceil((mat.getTime() - now.getTime()) / 86400000));
}

function totalDays(startDate: string, maturityDate: string): number {
  return Math.ceil((new Date(maturityDate).getTime() - new Date(startDate).getTime()) / 86400000);
}

function daysElapsed(startDate: string): number {
  return Math.max(0, Math.ceil((Date.now() - new Date(startDate).getTime()) / 86400000));
}

export default function FixedDepositsPage() {
  const { fc: formatCurrency } = useFormat();
  const [fds, setFds] = useState<FD[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    bankName: "",
    accountNumber: "",
    principal: "",
    interestRate: "",
    compounding: "quarterly",
    startDate: nowDateInputValueIST(),
    maturityDate: "",
    isAutoRenew: false,
    notes: "",
  });

  // For tenure shortcut
  const [tenureYears, setTenureYears] = useState("");
  const [tenureMonths, setTenureMonths] = useState("");

  const fetchFDs = useCallback(async () => {
    const res = await fetch("/api/fixed-deposits");
    const data = await res.json();
    setFds(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchFDs();
  }, [fetchFDs]);

  const computeMaturityDate = (startDate: string, years: string, months: string) => {
    if (!startDate) return "";
    const d = new Date(startDate);
    d.setFullYear(d.getFullYear() + (parseInt(years) || 0));
    d.setMonth(d.getMonth() + (parseInt(months) || 0));
    return toDateInputValueIST(d);
  };

  const handleTenureChange = (yrs: string, mos: string) => {
    setTenureYears(yrs);
    setTenureMonths(mos);
    if (form.startDate && (yrs || mos)) {
      const matDate = computeMaturityDate(form.startDate, yrs, mos);
      setForm((p) => ({ ...p, maturityDate: matDate }));
    }
  };

  const handleAdd = async () => {
    if (!form.bankName || !form.principal || !form.interestRate || !form.maturityDate) return;
    await fetch("/api/fixed-deposits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        bankName: form.bankName,
        accountNumber: form.accountNumber || undefined,
        principal: parseFloat(form.principal),
        interestRate: parseFloat(form.interestRate),
        compounding: form.compounding,
        startDate: form.startDate,
        maturityDate: form.maturityDate,
        isAutoRenew: form.isAutoRenew,
        notes: form.notes || undefined,
      }),
    });
    setShowAdd(false);
    setForm({ bankName: "", accountNumber: "", principal: "", interestRate: "", compounding: "quarterly", startDate: nowDateInputValueIST(), maturityDate: "", isAutoRenew: false, notes: "" });
    setTenureYears("");
    setTenureMonths("");
    fetchFDs();
    toast.success("FD added");
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/fixed-deposits/${id}`, { method: "DELETE" });
    fetchFDs();
    toast.success("FD removed");
  };

  const handleMarkMatured = async (id: string) => {
    await fetch(`/api/fixed-deposits/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "matured" }),
    });
    fetchFDs();
    toast.success("FD marked as matured");
  };

  // Preview calculation in add form
  const previewMaturity = (() => {
    if (!form.principal || !form.interestRate || !form.startDate || !form.maturityDate) return null;
    const p = parseFloat(form.principal);
    const r = parseFloat(form.interestRate) / 100;
    const n = COMPOUNDING_N[form.compounding] || 4;
    const years = (new Date(form.maturityDate).getTime() - new Date(form.startDate).getTime()) / (365.25 * 86400000);
    if (years <= 0) return null;
    const maturityAmount = p * Math.pow(1 + r / n, n * years);
    const interest = maturityAmount - p;
    return { maturityAmount, interest, years };
  })();

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

  const activeFDs = fds.filter((f) => f.status === "active");
  const maturedFDs = fds.filter((f) => f.status === "matured");

  const totalPrincipal = fds.reduce((s, f) => s + toDecimal(f.principal), 0);
  const totalMaturity = fds.reduce((s, f) => s + toDecimal(f.maturityAmount), 0);
  const totalCurrentValue = activeFDs.reduce((s, f) => {
    return s + calcCurrentValue(toDecimal(f.principal), toDecimal(f.interestRate), f.compounding, f.startDate);
  }, 0) + maturedFDs.reduce((s, f) => s + toDecimal(f.maturityAmount), 0);
  const totalInterest = totalMaturity - totalPrincipal;

  return (
    <div className="p-4 space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Fixed Deposits</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add FD
        </Button>
      </div>

      {fds.length === 0 ? (
        <EmptyState
          icon={<Landmark className="w-10 h-10" />}
          title="No Fixed Deposits"
          description="Track your FDs with auto-calculated interest and maturity"
          action={<Button onClick={() => setShowAdd(true)} size="sm">Add FD</Button>}
        />
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground">Total Principal</p>
                <p className="text-base font-bold">{formatCurrency(totalPrincipal, "INR", true)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground">Current Value</p>
                <p className="text-base font-bold text-success">{formatCurrency(totalCurrentValue, "INR", true)}</p>
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="p-3 flex items-center justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground">At Maturity</p>
                <p className="text-lg font-bold">{formatCurrency(totalMaturity, "INR", true)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-muted-foreground">Total Interest</p>
                <p className="text-lg font-bold text-success">+{formatCurrency(totalInterest, "INR", true)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Active FDs */}
          <AnimatePresence>
            <div className="space-y-3">
              {fds.map((fd) => {
                const principal = toDecimal(fd.principal);
                const rate = toDecimal(fd.interestRate);
                const maturity = toDecimal(fd.maturityAmount);
                const currentVal = fd.status === "matured"
                  ? maturity
                  : calcCurrentValue(principal, rate, fd.compounding, fd.startDate);
                const interestEarned = currentVal - principal;
                const totalInterestFD = maturity - principal;
                const remaining = daysRemaining(fd.maturityDate);
                const total = totalDays(fd.startDate, fd.maturityDate);
                const elapsed = daysElapsed(fd.startDate);
                const progressPercent = total > 0 ? Math.min(100, (elapsed / total) * 100) : 100;
                const isMatured = fd.status === "matured" || remaining === 0;

                return (
                  <motion.div
                    key={fd.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                  >
                    <Card className={isMatured ? "border-success/30" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isMatured ? "bg-success/10" : "bg-teal-500/10"}`}>
                              {isMatured ? (
                                <CheckCircle2 className="w-5 h-5 text-success" />
                              ) : (
                                <Landmark className="w-5 h-5 text-teal-500" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">{fd.bankName}</p>
                              {fd.accountNumber && (
                                <p className="text-[10px] text-muted-foreground truncate">A/c: {fd.accountNumber}</p>
                              )}
                            </div>
                          </div>
                          <Badge variant={isMatured ? "success" : "default"} className="shrink-0">
                            {isMatured ? "Matured" : `${remaining}d left`}
                          </Badge>
                        </div>

                        {/* Values Grid */}
                        <div className="grid grid-cols-3 gap-2 text-center mb-3">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Principal</p>
                            <p className="text-xs font-semibold">{formatCurrency(principal, "INR", true)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Current</p>
                            <p className="text-xs font-semibold text-success">{formatCurrency(currentVal, "INR", true)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">At Maturity</p>
                            <p className="text-xs font-semibold">{formatCurrency(maturity, "INR", true)}</p>
                          </div>
                        </div>

                        {/* Interest Earned */}
                        <div className="bg-muted/50 rounded-xl p-2.5 mb-3">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] text-muted-foreground">Interest Earned</span>
                            <span className="text-xs font-semibold text-success">
                              +{formatCurrency(interestEarned, "INR", true)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-muted-foreground">Total Interest (at maturity)</span>
                            <span className="text-xs font-medium">
                              {formatCurrency(totalInterestFD, "INR", true)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        {!isMatured && (
                          <div className="mb-3">
                            <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                              <span>{elapsed} days elapsed</span>
                              <span>{remaining} days left</span>
                            </div>
                            <Progress
                              value={progressPercent}
                              max={100}
                              size="sm"
                              indicatorClassName="bg-primary"
                            />
                          </div>
                        )}

                        {/* Bottom Info */}
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-2 border-t border-border/30 text-[10px] text-muted-foreground">
                          <span className="flex items-center gap-0.5">
                            <Percent className="w-3 h-3" /> {rate}% p.a.
                          </span>
                          <span className="flex items-center gap-0.5">
                            <RefreshCw className="w-3 h-3" /> {COMPOUNDING_LABELS[fd.compounding]}
                          </span>
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-3 h-3" /> {formatDate(fd.startDate)} → {formatDate(fd.maturityDate)}
                          </span>
                          {fd.isAutoRenew && (
                            <Badge variant="secondary">Auto-Renew</Badge>
                          )}
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 mt-3">
                          {!isMatured && fd.status !== "matured" && remaining === 0 && (
                            <button
                              onClick={() => handleMarkMatured(fd.id)}
                              className="flex-1 flex items-center justify-center gap-1 py-2 rounded-xl bg-success/10 text-success text-xs font-medium"
                            >
                              <CheckCircle2 className="w-3 h-3" /> Mark Matured
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(fd.id)}
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

      {/* Add FD Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Fixed Deposit">
        <div className="space-y-4">
          <Input
            label="Bank Name"
            placeholder="e.g., SBI, HDFC, ICICI"
            value={form.bankName}
            onChange={(e) => setForm((p) => ({ ...p, bankName: e.target.value }))}
          />
          <Input
            label="Account/FD Number (optional)"
            placeholder="e.g., FD123456"
            value={form.accountNumber}
            onChange={(e) => setForm((p) => ({ ...p, accountNumber: e.target.value }))}
          />
          <Input
            label="Principal Amount"
            type="number"
            placeholder="e.g., 100000"
            value={form.principal}
            onChange={(e) => setForm((p) => ({ ...p, principal: e.target.value }))}
            inputMode="decimal"
          />
          <Input
            label="Interest Rate (% per annum)"
            type="number"
            placeholder="e.g., 7.1"
            value={form.interestRate}
            onChange={(e) => setForm((p) => ({ ...p, interestRate: e.target.value }))}
            inputMode="decimal"
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Compounding</label>
            <select
              value={form.compounding}
              onChange={(e) => setForm((p) => ({ ...p, compounding: e.target.value }))}
              className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
            >
              {Object.entries(COMPOUNDING_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          <Input
            label="Start Date"
            type="date"
            value={form.startDate}
            onChange={(e) => {
              setForm((p) => ({ ...p, startDate: e.target.value }));
              if (tenureYears || tenureMonths) {
                const matDate = computeMaturityDate(e.target.value, tenureYears, tenureMonths);
                setForm((p) => ({ ...p, startDate: e.target.value, maturityDate: matDate }));
              }
            }}
          />

          <div>
            <label className="text-sm font-medium">Tenure (shortcut)</label>
            <div className="grid grid-cols-2 gap-2 mt-1.5">
              <Input
                type="number"
                placeholder="Years"
                value={tenureYears}
                onChange={(e) => handleTenureChange(e.target.value, tenureMonths)}
                inputMode="numeric"
              />
              <Input
                type="number"
                placeholder="Months"
                value={tenureMonths}
                onChange={(e) => handleTenureChange(tenureYears, e.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>

          <Input
            label="Maturity Date"
            type="date"
            value={form.maturityDate}
            onChange={(e) => setForm((p) => ({ ...p, maturityDate: e.target.value }))}
          />

          {/* Preview */}
          {previewMaturity && (
            <div className="bg-muted/50 rounded-xl p-3 space-y-1.5">
              <p className="text-xs font-medium">Preview</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground">Tenure</p>
                  <p className="text-xs font-semibold">
                    {Math.floor(previewMaturity.years)}y {Math.round((previewMaturity.years % 1) * 12)}m
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Maturity Amount</p>
                  <p className="text-xs font-semibold">{formatCurrency(previewMaturity.maturityAmount)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Interest Earned</p>
                  <p className="text-xs font-semibold text-success">+{formatCurrency(previewMaturity.interest)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Effective Rate</p>
                  <p className="text-xs font-semibold">
                    {((previewMaturity.interest / parseFloat(form.principal || "1")) * 100).toFixed(1)}% total
                  </p>
                </div>
              </div>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={form.isAutoRenew}
              onChange={(e) => setForm((p) => ({ ...p, isAutoRenew: e.target.checked }))}
              className="w-4 h-4 rounded accent-primary"
            />
            Auto-renew on maturity
          </label>

          <Button
            onClick={handleAdd}
            className="w-full"
            disabled={!form.bankName || !form.principal || !form.interestRate || !form.maturityDate}
          >
            Add Fixed Deposit
          </Button>
        </div>
      </Modal>
    </div>
  );
}
