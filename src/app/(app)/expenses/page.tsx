"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  Filter,
  Search,
  Calendar,
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
import { formatDateTime, toDecimal } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
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

const typeIcon = {
  income: TrendingUp,
  expense: TrendingDown,
  transfer: ArrowLeftRight,
};

const SAMPLE_CSV = `Date,Description,Debit,Credit
2026-02-01,UPI - Grocery Store,1250.00,
2026-02-02,Salary,,85000.00
2026-02-03,Electricity Bill,2100.50,`;

function localDateTimeValue(d = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

export default function ExpensesPage() {
  const { fc: formatCurrency } = useFormat();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importing, setImporting] = useState(false);
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
    date: localDateTimeValue(),
  });

  const fetchData = useCallback(async () => {
    const typeParam = activeTab !== "all" ? `&type=${activeTab}` : "";
    const [txnRes, catRes, accRes] = await Promise.all([
      fetch(`/api/transactions?limit=50${typeParam}`),
      fetch("/api/categories"),
      fetch("/api/accounts"),
    ]);
    const txnData = await txnRes.json();
    const catData = await catRes.json();
    const accData = await accRes.json();
    setTransactions(txnData.transactions || []);
    setCategories(catData || []);
    setAccounts(accData || []);
    setLoading(false);
  }, [activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    setFormData({
      amount: "",
      type: "expense",
      description: "",
      categoryId: "",
      accountId: "",
      date: localDateTimeValue(),
    });
    fetchData();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleImport = async () => {
    if (!importForm.csvText.trim()) return;
    setImporting(true);
    try {
      const res = await fetch("/api/transactions/import", {
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
        `Imported ${data.imported} txn • matched ${data.matchedExisting} • skipped ${data.skipped}`
      );
      setImportForm({ accountId: "", csvText: "" });
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
    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }
    try {
      const text = await file.text();
      setImportForm((p) => ({ ...p, csvText: text }));
      toast.success("CSV loaded. Review and import.");
    } catch {
      toast.error("Could not read CSV file");
    }
  };

  const filtered = transactions.filter((t) =>
    search
      ? t.description?.toLowerCase().includes(search.toLowerCase()) ||
        t.category?.name.toLowerCase().includes(search.toLowerCase()) ||
        t.account?.name.toLowerCase().includes(search.toLowerCase())
      : true
  );

  const totalExpense = filtered
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + toDecimal(t.amount), 0);
  const totalIncome = filtered
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + toDecimal(t.amount), 0);

  const categoryOptions = categories.filter((c) => {
    const ct = (c.type || "").toLowerCase().trim();
    if (formData.type === "transfer") return true;
    if (formData.type === "expense") {
      return ct.includes("expense") || ct.includes("debit") || !ct.includes("income");
    }
    return ct.includes("income") || ct.includes("credit");
  });

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

      <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)}>
        <Upload className="w-4 h-4 mr-1" />
        Import Statement CSV
      </Button>

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
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground flex-wrap">
                            <Calendar className="w-3 h-3 shrink-0" />
                            <span>{formatDateTime(txn.date)}</span>
                            {txn.category && (
                              <>
                                <span>·</span>
                                <span className="truncate">{txn.category.name}</span>
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

      <div className="fixed bottom-20 right-4 z-30">
        <Button
          onClick={() => setShowAddModal(true)}
          size="lg"
          className="rounded-full shadow-lg"
        >
          + Add
        </Button>
      </div>

      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Transaction"
      >
        <div className="space-y-4">
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
        title="Import Bank Statement CSV"
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
                Choose CSV File
                <input
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => handleImportFile(e.target.files?.[0] || null)}
                />
              </label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setImportForm((p) => ({ ...p, csvText: SAMPLE_CSV }))}
              >
                Use Sample CSV
              </Button>
            </div>
            <textarea
              rows={10}
              value={importForm.csvText}
              onChange={(e) =>
                setImportForm((p) => ({
                  ...p,
                  csvText: e.target.value,
                }))
              }
              placeholder="Paste CSV with headers like Date, Description/Narration, Amount or Debit/Credit"
              className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs text-muted-foreground">
              Duplicate rows are auto-reconciled. Supported headers: Date, Description/Narration,
              Amount or Debit/Credit.
            </p>
          </div>

          <Button
            onClick={handleImport}
            className="w-full"
            disabled={importing || !importForm.csvText.trim()}
          >
            {importing ? "Importing..." : "Import & Reconcile"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
