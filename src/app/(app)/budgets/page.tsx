"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { PieChart, Plus, AlertTriangle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { getMonthName, toDecimal } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { toast } from "sonner";

interface BudgetItem {
  id: string;
  amount: number;
  spent: number;
  categoryId: string;
  category: { id: string; name: string; icon: string | null; color: string | null };
}

interface Category {
  id: string;
  name: string;
  color: string | null;
  type: string;
}

export default function BudgetsPage() {
  const { fc: formatCurrency } = useFormat();
  const [budgets, setBudgets] = useState<BudgetItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [form, setForm] = useState({ categoryId: "", amount: "" });

  const fetchData = async () => {
    const [budgetRes, catRes] = await Promise.all([
      fetch(`/api/budgets?month=${month}&year=${year}`),
      fetch("/api/categories"),
    ]);
    const budgetData = await budgetRes.json();
    const catData = await catRes.json();
    setBudgets(budgetData || []);
    setCategories(catData || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [month, year]);

  const handleAdd = async () => {
    if (!form.categoryId || !form.amount) return;
    await fetch("/api/budgets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId: form.categoryId,
        amount: parseFloat(form.amount),
        month,
        year,
      }),
    });
    setShowAdd(false);
    setForm({ categoryId: "", amount: "" });
    fetchData();
    toast.success("Budget set");
  };

  const totalBudget = budgets.reduce((s, b) => s + b.amount, 0);
  const totalSpent = budgets.reduce((s, b) => s + b.spent, 0);
  const overBudgetCount = budgets.filter((b) => b.spent > b.amount).length;

  if (loading) {
    return <div className="p-4 space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Budget</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1" /> Set Budget
        </Button>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => { if (month === 1) { setMonth(12); setYear(year - 1); } else setMonth(month - 1); }}
          className="p-2 rounded-lg hover:bg-muted"
        >
          ←
        </button>
        <span className="flex-1 text-center text-sm font-medium">
          {getMonthName(month)} {year}
        </span>
        <button
          onClick={() => { if (month === 12) { setMonth(1); setYear(year + 1); } else setMonth(month + 1); }}
          className="p-2 rounded-lg hover:bg-muted"
        >
          →
        </button>
      </div>

      {budgets.length > 0 && (
        <Card>
          <CardContent className="p-4">
            <div className="flex justify-between items-end mb-2">
              <div>
                <p className="text-xs text-muted-foreground">Total Spent</p>
                <p className="text-xl font-bold">{formatCurrency(totalSpent)}</p>
              </div>
              <p className="text-xs text-muted-foreground">
                of {formatCurrency(totalBudget)}
              </p>
            </div>
            <Progress value={totalSpent} max={totalBudget} />
            {overBudgetCount > 0 && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-destructive">
                <AlertTriangle className="w-3.5 h-3.5" />
                {overBudgetCount} {overBudgetCount === 1 ? "category" : "categories"} over budget
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {budgets.length === 0 ? (
        <EmptyState
          icon={<PieChart className="w-10 h-10" />}
          title="No budgets set"
          description={`Set monthly budgets for ${getMonthName(month)}`}
          action={<Button onClick={() => setShowAdd(true)} size="sm">Set Budget</Button>}
        />
      ) : (
        <div className="space-y-2">
          {budgets.map((b) => {
            const percent = b.amount > 0 ? (b.spent / b.amount) * 100 : 0;
            const isOver = b.spent > b.amount;
            return (
              <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card className={isOver ? "border-destructive/30" : ""}>
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: b.category.color || "#6b7280" }}
                        />
                        <span className="text-sm font-medium">{b.category.name}</span>
                      </div>
                      <div className="text-right">
                        <span className={`text-sm font-semibold ${isOver ? "text-destructive" : ""}`}>
                          {formatCurrency(b.spent)}
                        </span>
                        <span className="text-xs text-muted-foreground"> / {formatCurrency(b.amount)}</span>
                      </div>
                    </div>
                    <Progress value={b.spent} max={b.amount} size="sm" />
                    {isOver && (
                      <p className="text-[10px] text-destructive mt-1">
                        Over by {formatCurrency(b.spent - b.amount)}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Set Budget">
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Category</label>
            <select
              value={form.categoryId}
              onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
              className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
            >
              <option value="">Select category</option>
              {categories.filter((c) => c.type === "expense").map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <Input
            label="Monthly Budget"
            type="number"
            value={form.amount}
            onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
            inputMode="decimal"
          />
          <Button onClick={handleAdd} className="w-full" disabled={!form.categoryId || !form.amount}>
            Set Budget
          </Button>
        </div>
      </Modal>
    </div>
  );
}
