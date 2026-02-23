"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Landmark, Plus, TrendingUp, TrendingDown, Wallet, Building2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { DonutChart } from "@/components/charts/donut-chart";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toDecimal } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { toast } from "sonner";

interface NetWorthData {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  breakdown: {
    bankAccounts: number;
    investments: number;
    investmentCost: number;
    investmentGain: number;
    offlineAssets: number;
  };
  liabilities: {
    id: string;
    name: string;
    type: string;
    principal: number;
    outstanding: number;
    interestRate: number;
    emiAmount: number | null;
    startDate: string;
    endDate: string | null;
  }[];
}

export default function NetWorthPage() {
  const { fc: formatCurrency, fp: formatPercent } = useFormat();
  const [data, setData] = useState<NetWorthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddLoan, setShowAddLoan] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "home_loan",
    principal: "",
    outstanding: "",
    interestRate: "",
    emiAmount: "",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    fetch("/api/net-worth")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const handleAddLoan = async () => {
    if (!form.name || !form.principal) return;
    await fetch("/api/liabilities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        principal: parseFloat(form.principal),
        outstanding: parseFloat(form.outstanding || form.principal),
        interestRate: parseFloat(form.interestRate || "0"),
        emiAmount: form.emiAmount ? parseFloat(form.emiAmount) : null,
        endDate: form.endDate || null,
      }),
    });
    setShowAddLoan(false);
    setForm({ name: "", type: "home_loan", principal: "", outstanding: "", interestRate: "", emiAmount: "", startDate: "", endDate: "" });
    const res = await fetch("/api/net-worth");
    setData(await res.json());
    toast.success("Liability added");
  };

  if (loading || !data) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  const assetData = [
    { name: "Bank Accounts", value: data.breakdown.bankAccounts, color: "#3b82f6" },
    { name: "Investments", value: data.breakdown.investments, color: "#22c55e" },
    { name: "Offline Assets", value: data.breakdown.offlineAssets, color: "#f97316" },
  ].filter((d) => d.value > 0);

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Net Worth</h2>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0">
          <CardContent className="p-5 text-center">
            <p className="text-xs opacity-70">Net Worth</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(data.netWorth)}</p>
            <div className="flex justify-center gap-6 mt-3 text-xs">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5" />
                <span>Assets: {formatCurrency(data.totalAssets, "INR", true)}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingDown className="w-3.5 h-3.5" />
                <span>Debts: {formatCurrency(data.totalLiabilities, "INR", true)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <Card>
        <CardHeader>
          <CardTitle>Asset Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          {assetData.length > 0 ? (
            <>
              <DonutChart
                data={assetData}
                innerLabel="Total"
                innerValue={formatCurrency(data.totalAssets, "INR", true)}
                height={200}
              />
              <div className="mt-3 space-y-2">
                {assetData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span>{item.name}</span>
                    </div>
                    <span className="font-medium">{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">No assets tracked yet</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Liabilities</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setShowAddLoan(true)}>
              <Plus className="w-4 h-4 mr-1" /> Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {data.liabilities.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">No liabilities</p>
          ) : (
            <div className="space-y-3">
              {data.liabilities.map((loan) => {
                const paidPercent = loan.principal > 0
                  ? ((loan.principal - loan.outstanding) / loan.principal) * 100
                  : 0;
                return (
                  <div key={loan.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">{loan.name}</span>
                      </div>
                      <span className="text-sm font-semibold text-destructive">
                        {formatCurrency(loan.outstanding)}
                      </span>
                    </div>
                    <Progress value={loan.principal - loan.outstanding} max={loan.principal} size="sm" />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>{loan.interestRate}% p.a.</span>
                      {loan.emiAmount && <span>EMI: {formatCurrency(loan.emiAmount)}</span>}
                      <span>{paidPercent.toFixed(0)}% paid</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Modal open={showAddLoan} onClose={() => setShowAddLoan(false)} title="Add Liability">
        <div className="space-y-4">
          <Input label="Name" placeholder="Home Loan" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <select value={form.type} onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))} className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm">
              <option value="home_loan">Home Loan</option>
              <option value="car_loan">Car Loan</option>
              <option value="personal_loan">Personal Loan</option>
              <option value="education_loan">Education Loan</option>
              <option value="credit_card">Credit Card</option>
              <option value="other">Other</option>
            </select>
          </div>
          <Input label="Principal Amount" type="number" value={form.principal} onChange={(e) => setForm((p) => ({ ...p, principal: e.target.value }))} inputMode="decimal" />
          <Input label="Outstanding Amount" type="number" placeholder="Leave empty to use principal" value={form.outstanding} onChange={(e) => setForm((p) => ({ ...p, outstanding: e.target.value }))} inputMode="decimal" />
          <Input label="Interest Rate (%)" type="number" value={form.interestRate} onChange={(e) => setForm((p) => ({ ...p, interestRate: e.target.value }))} inputMode="decimal" />
          <Input label="EMI Amount" type="number" value={form.emiAmount} onChange={(e) => setForm((p) => ({ ...p, emiAmount: e.target.value }))} inputMode="decimal" />
          <Input label="Start Date" type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
          <Input label="End Date" type="date" value={form.endDate} onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))} />
          <Button onClick={handleAddLoan} className="w-full" disabled={!form.name || !form.principal}>
            Add Liability
          </Button>
        </div>
      </Modal>
    </div>
  );
}
