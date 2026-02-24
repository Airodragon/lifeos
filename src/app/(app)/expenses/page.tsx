"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Filter,
  Search,
  Calendar,
  Pencil,
  ArrowLeftRight,
  Upload,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { DonutChart } from "@/components/charts/donut-chart";
import { BarChart } from "@/components/charts/bar-chart";
import {
  formatDateTime,
  nowDateTimeInputValueIST,
  toDateInputValueIST,
  toDateTimeInputValueIST,
  toDecimal,
} from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { markDataSynced } from "@/lib/sync-status";
import { toast } from "sonner";

interface Transaction {
  id: string;
  amount: string;
  type: string;
  description: string | null;
  date: string;
  category: { id: string; name: string; icon: string | null; color: string | null } | null;
  account: { id: string; name: string } | null;
  tags: string[];
}

interface Category {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  type: string;
}

interface Account {
  id: string;
  name: string;
  type: string;
}

interface LayerInsightPayload {
  anomalies: Array<{
    category: string;
    current: number;
    baseline: number;
    jumpPercent: number;
  }>;
}

interface BudgetRow {
  categoryId: string;
  amount: number;
  spent: number;
}

const typeIcon = {
  income: TrendingUp,
  expense: TrendingDown,
  transfer: ArrowLeftRight,
};

const SAMPLE_CSV = `Date,Description,Debit,Credit
2026-02-01,UPI - Grocery Store,1250.00,
2026-02-02,Salary,,85000.00
2026-02-03,Electricity Bill,2100.50,`;
const BANK_TEMPLATES: Record<string, string> = {
  HDFC: `Date,Narration,Debit,Credit\n2026-02-01,UPI-PAYMENT,450.00,`,
  ICICI: `Transaction Date,Transaction Remarks,Withdrawal Amount,Deposit Amount\n2026-02-01,UPI PAYMENT,450.00,`,
  AXIS: `Tran Date,Particulars,Debit,Credit\n2026-02-01,UPI/1234,450.00,`,
  SBI: `Txn Date,Description,Debit,Credit\n2026-02-01,UPI DR,450.00,`,
  KOTAK: `Date,Description,Debit,Credit\n2026-02-01,POS DR,450.00,`,
};
const CHART_COLORS = ["#3b82f6", "#22c55e", "#f97316", "#8b5cf6", "#14b8a6", "#ec4899"];

export default function ExpensesPage() {
  const { fc: formatCurrency } = useFormat();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [chartRange, setChartRange] = useState<"7d" | "30d" | "3m" | "1y">("30d");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [layerInsights, setLayerInsights] = useState<LayerInsightPayload | null>(null);
  const [budgets, setBudgets] = useState<BudgetRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [importForm, setImportForm] = useState({
    accountId: "",
    csvText: "",
  });
  const [formData, setFormData] = useState({
    amount: "",
    type: "expense",
    description: "",
    categoryId: "",
    accountId: "",
    date: nowDateTimeInputValueIST(),
  });
  const [editFormData, setEditFormData] = useState({
    id: "",
    amount: "",
    type: "expense",
    description: "",
    categoryId: "",
    accountId: "",
    date: nowDateTimeInputValueIST(),
  });
  const quickCategories = ["Food", "Fuel", "Bills", "Transfer", "Groceries", "Health"];

  const fetchData = useCallback(async () => {
    const params = new URLSearchParams({
      limit: "20",
      page: String(page),
    });
    if (activeTab !== "all") params.set("type", activeTab);
    if (search.trim()) params.set("q", search.trim());
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const [txnRes, catRes, accRes] = await Promise.all([
      fetch(`/api/transactions?${params.toString()}`),
      fetch("/api/categories"),
      fetch("/api/accounts"),
    ]);
    const txnData = await txnRes.json();
    const catData = await catRes.json();
    const accData = await accRes.json();
    setTransactions((prev) =>
      page === 1 ? (txnData.transactions || []) : [...prev, ...(txnData.transactions || [])]
    );
    setHasMore((txnData.page || 1) * (txnData.limit || 20) < (txnData.total || 0));
    setCategories(catData || []);
    setAccounts(accData || []);
    markDataSynced();
    setLoading(false);
  }, [activeTab, search, startDate, endDate, page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, search, startDate, endDate]);

  useEffect(() => {
    fetch("/api/insights/layer")
      .then((r) => r.json())
      .then((d) => {
        if (!d?.error) setLayerInsights(d);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/budgets")
      .then((r) => r.json())
      .then((rows) => {
        if (Array.isArray(rows)) setBudgets(rows);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lifeos-expense-form-defaults");
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<typeof formData>;
      setFormData((prev) => ({
        ...prev,
        type: parsed.type || prev.type,
        accountId: parsed.accountId || prev.accountId,
        categoryId: parsed.categoryId || prev.categoryId,
      }));
    } catch {
      // ignore malformed local storage
    }
  }, []);

  const handleAdd = async () => {
    if (!formData.amount) return;
    await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...formData,
        amount: parseFloat(formData.amount),
        date: formData.date,
        categoryId: formData.categoryId || undefined,
        accountId: formData.accountId || undefined,
      }),
    });
    setShowAddModal(false);
    localStorage.setItem(
      "lifeos-expense-form-defaults",
      JSON.stringify({
        type: formData.type,
        accountId: formData.accountId,
        categoryId: formData.categoryId,
      })
    );
    setFormData({
      amount: "",
      type: "expense",
      description: "",
      categoryId: "",
      accountId: "",
      date: nowDateTimeInputValueIST(),
    });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    setPage(1);
    fetchData();
  };

  const openEdit = (txn: Transaction) => {
    setEditFormData({
      id: txn.id,
      amount: toDecimal(txn.amount).toString(),
      type: txn.type,
      description: txn.description || "",
      categoryId: txn.category?.id || "",
      accountId: txn.account?.id || "",
      date: toDateTimeInputValueIST(txn.date),
    });
    setShowEditModal(true);
  };

  const handleEditSave = async () => {
    if (!editFormData.id || !editFormData.amount) return;
    const res = await fetch(`/api/transactions/${editFormData.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(editFormData.amount),
        type: editFormData.type,
        description: editFormData.description || undefined,
        date: editFormData.date,
        categoryId: editFormData.categoryId || undefined,
        accountId: editFormData.accountId || undefined,
      }),
    });
    if (!res.ok) {
      toast.error("Failed to update transaction");
      return;
    }
    setShowEditModal(false);
    setPage(1);
    fetchData();
    toast.success("Transaction updated");
  };

  const handleImport = async () => {
    if (!importFile && !importForm.csvText.trim()) return;
    setImporting(true);
    try {
      const res = importFile
        ? await (() => {
            const fd = new FormData();
            fd.set("file", importFile);
            if (importForm.accountId) fd.set("accountId", importForm.accountId);
            return fetch("/api/transactions/import", {
              method: "POST",
              body: fd,
            });
          })()
        : await fetch("/api/transactions/import", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(importForm),
          });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Import failed");
        return;
      }
      toast.success(
        `Imported ${data.imported} txn • matched ${data.matchedExisting} • categorized ${data.categorized || 0} • skipped ${data.skipped}`
      );
      setImportForm({ accountId: "", csvText: "" });
      setImportFile(null);
      setImportFileName("");
      setShowImportModal(false);
      fetchData();
    } catch {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  const handleImportFile = async (file: File | null) => {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".pdf")) {
      toast.error("Please upload a CSV or PDF file");
      return;
    }
    try {
      setImportFile(file);
      setImportFileName(file.name);
      if (name.endsWith(".csv")) {
        const text = await file.text();
        setImportForm((p) => ({ ...p, csvText: text }));
        toast.success("CSV loaded. Review and import.");
      } else {
        setImportForm((p) => ({ ...p, csvText: "" }));
        toast.success("PDF loaded. AI extraction will run on import.");
      }
    } catch {
      toast.error("Could not read file");
    }
  };

  const exportTransactionsCsv = () => {
    const rows = [
      ["Date", "Type", "Description", "Category", "Account", "Amount"],
      ...filtered.map((txn) => [
        new Date(txn.date).toISOString(),
        txn.type,
        txn.description || "",
        txn.category?.name || "",
        txn.account?.name || "",
        txn.amount,
      ]),
    ];
    const csv = rows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lifeos-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = transactions;
  const recurringByDescription = filtered.reduce((acc, txn) => {
    const key = (txn.description || "").trim().toLowerCase();
    if (!key) return acc;
    acc.set(key, (acc.get(key) || 0) + 1);
    return acc;
  }, new Map<string, number>());

  const totalExpense = filtered
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + toDecimal(t.amount), 0);
  const totalIncome = filtered
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + toDecimal(t.amount), 0);
  const rangeStart = (() => {
    const now = new Date();
    const d = new Date(now);
    if (chartRange === "7d") d.setDate(now.getDate() - 7);
    else if (chartRange === "30d") d.setDate(now.getDate() - 30);
    else if (chartRange === "3m") d.setMonth(now.getMonth() - 3);
    else d.setFullYear(now.getFullYear() - 1);
    return d;
  })();
  const chartTxns = filtered.filter((t) => new Date(t.date) >= rangeStart);
  const chartExpenseTotal = chartTxns
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + toDecimal(t.amount), 0);
  const categoryData = Array.from(
    chartTxns
      .filter((t) => t.type === "expense")
      .reduce((acc, txn) => {
        const key = txn.category?.name || "Other";
        acc.set(key, (acc.get(key) || 0) + toDecimal(txn.amount));
        return acc;
      }, new Map<string, number>())
      .entries()
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value], i) => ({
      name,
      value,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  const dailySpendData = Array.from(
    chartTxns
      .filter((t) => t.type === "expense")
      .reduce((acc, txn) => {
        const dayKey = toDateInputValueIST(txn.date);
        acc.set(dayKey, (acc.get(dayKey) || 0) + toDecimal(txn.amount));
        return acc;
      }, new Map<string, number>())
      .entries()
  )
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-10)
    .map(([day, value]) => ({
      day: new Date(day).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        timeZone: "Asia/Kolkata",
      }),
      Spend: value,
    }));

  const categoryOptions = categories.filter((c) => {
    const ct = (c.type || "").toLowerCase().trim();
    if (formData.type === "transfer") return true;
    if (formData.type === "expense") {
      return ct.includes("expense") || ct.includes("debit") || !ct.includes("income");
    }
    return ct.includes("income") || ct.includes("credit");
  });
  const editCategoryOptions = categories.filter((c) => {
    const ct = (c.type || "").toLowerCase().trim();
    if (editFormData.type === "transfer") return true;
    if (editFormData.type === "expense") {
      return ct.includes("expense") || ct.includes("debit") || !ct.includes("income");
    }
    return ct.includes("income") || ct.includes("credit");
  });
  const budgetByCategory = new Map(budgets.map((b) => [b.categoryId, b]));

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-6">
      {layerInsights?.anomalies?.length ? (
        <Card>
          <CardContent className="p-3 space-y-2">
            <p className="text-xs font-medium">Expense Intelligence</p>
            {layerInsights.anomalies.slice(0, 3).map((row) => (
              <div key={row.category} className="text-xs flex items-center justify-between">
                <span className="truncate">{row.category}</span>
                <span className="text-warning">+{row.jumpPercent.toFixed(0)}% vs baseline</span>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex gap-3">
        <Card className="flex-1">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Income</p>
            <p className="text-base sm:text-lg font-bold text-success">
              {formatCurrency(totalIncome, "INR", true)}
            </p>
          </CardContent>
        </Card>
        <Card className="flex-1">
          <CardContent className="p-3 text-center">
            <p className="text-[10px] text-muted-foreground">Expenses</p>
            <p className="text-base sm:text-lg font-bold text-destructive">
              {formatCurrency(totalExpense, "INR", true)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Tabs
        tabs={[
          { id: "all", label: "All" },
          { id: "expense", label: "Expense" },
          { id: "income", label: "Income" },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {(categoryData.length > 0 || dailySpendData.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="lg:col-span-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Charts for {chartRange.toUpperCase()}</p>
            <div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1 text-xs">
              {(["7d", "30d", "3m", "1y"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setChartRange(r)}
                  className={`rounded-lg px-2 py-1.5 uppercase ${
                    chartRange === r ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
          {categoryData.length > 0 && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs font-medium mb-2">Expense Breakdown</p>
                <DonutChart
                  data={categoryData}
                  innerLabel="Top categories"
                  innerValue={formatCurrency(chartExpenseTotal, "INR", true)}
                  height={190}
                />
              </CardContent>
            </Card>
          )}
          {dailySpendData.length > 0 && (
            <Card>
              <CardContent className="p-3">
                <p className="text-xs font-medium mb-2">Recent Daily Spend</p>
                <BarChart
                  data={dailySpendData}
                  bars={[{ dataKey: "Spend", color: "#ef4444", name: "Spend" }]}
                  xAxisKey="day"
                  height={190}
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full h-10 pl-9 pr-4 rounded-xl border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          label="From"
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          label="To"
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
          <Upload className="w-4 h-4 mr-1" />
          Import Statement CSV/PDF
        </Button>
        <Button variant="outline" size="sm" onClick={exportTransactionsCsv}>
          Export CSV
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Filter className="w-10 h-10" />}
          title="No transactions"
          description="Add your first transaction to start tracking"
          action={
            <Button onClick={() => setShowAddModal(true)} size="sm">
              Add Transaction
            </Button>
          }
        />
      ) : (
        <AnimatePresence>
          <div className="space-y-2">
            {filtered.map((txn) => {
              const Icon = typeIcon[txn.type as keyof typeof typeIcon] || TrendingDown;
              return (
                <motion.div
                  key={txn.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                >
                  <Card>
                    <CardContent className="p-3 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div
                          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                          style={{
                            backgroundColor: txn.category?.color
                              ? `${txn.category.color}15`
                              : "var(--muted)",
                            color: txn.category?.color || "var(--muted-foreground)",
                          }}
                        >
                          <Icon className="w-4.5 h-4.5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {txn.description || txn.category?.name || "Transaction"}
                          </p>
                          {txn.description &&
                            (recurringByDescription.get(txn.description.trim().toLowerCase()) || 0) >= 3 && (
                              <p className="text-[10px] text-primary/80">Recurring pattern</p>
                            )}
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>{formatDateTime(txn.date)}</span>
                            {txn.category && (
                              <>
                                <span>·</span>
                                <span className="truncate">{txn.category.name}</span>
                                {(() => {
                                  const budget = budgetByCategory.get(txn.category.id);
                                  if (!budget || budget.amount <= 0) return null;
                                  const usage = (budget.spent / budget.amount) * 100;
                                  if (usage < 100) return null;
                                  return <span className="text-destructive">Over budget</span>;
                                })()}
                              </>
                            )}
                            {txn.account && (
                              <>
                                <span>·</span>
                                <span className="truncate">{txn.account.name}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm font-semibold ${
                            txn.type === "income" ? "text-success" : ""
                          }`}
                        >
                          {txn.type === "income" ? "+" : "-"}
                          {formatCurrency(toDecimal(txn.amount))}
                        </p>
                        <button
                          onClick={() => openEdit(txn)}
                          className="mr-2 inline-flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary"
                        >
                          <Pencil className="w-3 h-3" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(txn.id)}
                          className="text-[10px] text-destructive/60 hover:text-destructive"
                        >
                          Delete
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </AnimatePresence>
      )}
      {hasMore && (
        <Button variant="outline" className="w-full" onClick={() => setPage((p) => p + 1)}>
          Load more transactions
        </Button>
      )}

      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Transaction"
      >
        <div className="space-y-4">
          <div className="flex gap-1.5 flex-wrap">
            {quickCategories.map((name) => (
              <button
                key={name}
                type="button"
                className="px-2.5 py-1 rounded-full text-xs bg-muted text-muted-foreground hover:text-foreground"
                onClick={() => {
                  const match = categories.find(
                    (c) => c.name.toLowerCase() === name.toLowerCase()
                  );
                  if (name.toLowerCase() === "transfer") {
                    setFormData((p) => ({ ...p, type: "transfer", categoryId: match?.id || "" }));
                    return;
                  }
                  if (match) {
                    setFormData((p) => ({
                      ...p,
                      type: match.type.toLowerCase().includes("income") ? "income" : "expense",
                      categoryId: match.id,
                    }));
                    return;
                  }
                  setFormData((p) => ({ ...p, description: p.description || name }));
                }}
              >
                {name}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {["expense", "income", "transfer"].map((t) => (
              <button
                key={t}
                onClick={() => setFormData((p) => ({ ...p, type: t }))}
                className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize ${
                  formData.type === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <Input
            label="Amount"
            type="number"
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) => setFormData((p) => ({ ...p, amount: e.target.value }))}
            inputMode="decimal"
          />
          <Input
            label="Description"
            placeholder="What was this for?"
            value={formData.description}
            onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Category</label>
            <select
              value={formData.categoryId}
              onChange={(e) => setFormData((p) => ({ ...p, categoryId: e.target.value }))}
              className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
            >
              <option value="">Select category</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {categoryOptions.length === 0 && (
              <p className="text-xs text-muted-foreground">
                No categories found for this type. Create one in Settings/Categories.
              </p>
            )}
          </div>
          {accounts.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Account</label>
              <select
                value={formData.accountId}
                onChange={(e) => setFormData((p) => ({ ...p, accountId: e.target.value }))}
                className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
              >
                <option value="">No account</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <Input
            label="Date & Time"
            type="datetime-local"
            value={formData.date}
            onChange={(e) => setFormData((p) => ({ ...p, date: e.target.value }))}
          />
          <Button onClick={handleAdd} className="w-full" disabled={!formData.amount}>
            Add Transaction
          </Button>
        </div>
      </Modal>

      <Modal
        open={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import Bank Statement"
      >
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Map to Account (optional)</label>
            <select
              value={importForm.accountId}
              onChange={(e) =>
                setImportForm((p) => ({
                  ...p,
                  accountId: e.target.value,
                }))
              }
              className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
            >
              <option value="">No account mapping</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">CSV Content</label>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center justify-center h-9 px-3 rounded-xl border border-input text-sm cursor-pointer hover:bg-muted">
                Choose CSV/PDF File
                <input
                  type="file"
                  accept=".csv,text/csv,.pdf,application/pdf"
                  className="hidden"
                  onChange={(e) => handleImportFile(e.target.files?.[0] || null)}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportFile(null);
                  setImportFileName("");
                  setImportForm((p) => ({ ...p, csvText: SAMPLE_CSV }));
                }}
              >
                Use Sample CSV
              </Button>
              {Object.keys(BANK_TEMPLATES).map((bank) => (
                <Button
                  key={bank}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setImportFile(null);
                    setImportFileName("");
                    setImportForm((p) => ({
                      ...p,
                      csvText: BANK_TEMPLATES[bank],
                    }));
                  }}
                >
                  {bank} Template
                </Button>
              ))}
            </div>
            <textarea
              rows={10}
              value={importForm.csvText}
              onChange={(e) => {
                setImportFile(null);
                setImportFileName("");
                setImportForm((p) => ({
                  ...p,
                  csvText: e.target.value,
                }));
              }}
              placeholder="Paste CSV with headers like Date, Description/Narration, Amount or Debit/Credit (optional when PDF is uploaded)"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {importFileName ? (
              <p className="text-xs text-muted-foreground">
                Selected file: <span className="font-medium">{importFileName}</span>
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Duplicate rows are auto-reconciled. CSV and PDF statements are supported.
            </p>
          </div>

          <Button
            onClick={handleImport}
            className="w-full"
            disabled={importing || (!importFile && !importForm.csvText.trim())}
          >
            {importing ? "Importing..." : "Import & Reconcile"}
          </Button>
        </div>
      </Modal>

      <Modal
        open={showEditModal}
        onClose={() => setShowEditModal(false)}
        title="Edit Transaction"
      >
        <div className="space-y-4">
          <div className="flex gap-2">
            {["expense", "income", "transfer"].map((t) => (
              <button
                key={t}
                onClick={() => setEditFormData((p) => ({ ...p, type: t }))}
                className={`flex-1 py-2 rounded-xl text-sm font-medium capitalize ${
                  editFormData.type === t
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <Input
            label="Amount"
            type="number"
            value={editFormData.amount}
            onChange={(e) => setEditFormData((p) => ({ ...p, amount: e.target.value }))}
            inputMode="decimal"
          />
          <Input
            label="Description"
            value={editFormData.description}
            onChange={(e) => setEditFormData((p) => ({ ...p, description: e.target.value }))}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Category</label>
            <select
              value={editFormData.categoryId}
              onChange={(e) => setEditFormData((p) => ({ ...p, categoryId: e.target.value }))}
              className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
            >
              <option value="">Select category</option>
              {editCategoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Account</label>
            <select
              value={editFormData.accountId}
              onChange={(e) => setEditFormData((p) => ({ ...p, accountId: e.target.value }))}
              className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
            >
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="Date & Time"
            type="datetime-local"
            value={editFormData.date}
            onChange={(e) => setEditFormData((p) => ({ ...p, date: e.target.value }))}
          />
          <Button onClick={handleEditSave} className="w-full" disabled={!editFormData.amount}>
            Save Changes
          </Button>
        </div>
      </Modal>
    </div>
  );
}
