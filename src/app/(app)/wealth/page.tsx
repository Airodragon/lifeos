"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TrendingUp, Plus, ShieldAlert, IndianRupee } from "lucide-react";
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

const TRACKING_START = "2026-03-01";

export default function WealthPage() {
  const { fc: formatCurrency, fp: formatPercent } = useFormat();
  const [activeTab, setActiveTab] = useState("investments");
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [liabilities, setLiabilities] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);
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
    const [invRes, liabRes] = await Promise.all([
      fetch("/api/investments"),
      fetch("/api/liabilities"),
    ]);
    const invData = await invRes.json();
    const liabData = await liabRes.json();
    setInvestments(invData || []);
    setLiabilities(liabData || []);
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

  const liabilityTotals = useMemo(() => {
    const principal = liabilities.reduce((sum, l) => sum + toDecimal(l.principal), 0);
    const outstanding = liabilities.reduce((sum, l) => sum + toDecimal(l.outstanding), 0);
    const emi = liabilities.reduce((sum, l) => sum + toDecimal(l.emiAmount), 0);
    return { principal, outstanding, emi };
  }, [liabilities]);

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
        <Button variant="outline" size="sm" onClick={fetchData}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Investment Value</p>
            <p className="text-sm font-semibold">{formatCurrency(investmentTotals.totalValue, "INR", true)}</p>
            <p className={`text-[10px] ${investmentTotals.totalGain >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(investmentTotals.totalGain, "INR", true)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Outstanding Liability</p>
            <p className="text-sm font-semibold text-destructive">
              {formatCurrency(liabilityTotals.outstanding, "INR", true)}
            </p>
            <p className="text-[10px] text-muted-foreground">
              EMI {formatCurrency(liabilityTotals.emi, "INR", true)}/mo
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        tabs={[
          { id: "investments", label: "Investments" },
          { id: "liabilities", label: "Liabilities" },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === "investments" ? (
        <Card>
          <CardHeader className="flex-row items-center justify-between">
            <CardTitle className="text-sm">Portfolio Holdings</CardTitle>
            <Link href="/investments">
              <Button size="sm" variant="outline">
                <TrendingUp className="w-4 h-4 mr-1" />
                Open Full
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
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
      ) : (
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
                  <div className="grid grid-cols-3 gap-2 mt-1">
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
                      <p className="font-semibold flex items-center gap-0.5">
                        <IndianRupee className="w-3 h-3" />
                        {formatCurrency(toDecimal(row.emiAmount), "INR", true)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-3 text-xs text-muted-foreground flex items-start gap-2">
          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
          Add historical purchases and liabilities manually whenever ready. Day-to-day tracking will continue cleanly from March.
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

