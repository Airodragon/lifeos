"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowDown, ArrowUp, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { nowDateTimeInputValueIST } from "@/lib/utils";
import { toast } from "sonner";

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Category {
  id: string;
  name: string;
  type: string;
}

interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
  contextPath?: string;
}

export function QuickAddSheet({ open, onClose, contextPath = "" }: QuickAddSheetProps) {
  const router = useRouter();
  const [type, setType] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [date, setDate] = useState(nowDateTimeInputValueIST());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const quickCategories = ["Food", "Fuel", "Bills", "Transfer", "Groceries", "Health"];

  useEffect(() => {
    if (open) {
      if (contextPath.startsWith("/expenses")) {
        setType("expense");
      } else if (contextPath.startsWith("/dashboard")) {
        setType("expense");
      }
      Promise.all([fetch("/api/accounts"), fetch("/api/categories")])
        .then(async ([aRes, cRes]) => {
          const [aData, cData] = await Promise.all([aRes.json(), cRes.json()]);
          setAccounts(aData || []);
          setCategories(cData || []);
          try {
            const saved = localStorage.getItem("lifeos-expense-form-defaults");
            if (saved) {
              const parsed = JSON.parse(saved) as {
                type?: "expense" | "income" | "transfer";
                accountId?: string;
                categoryId?: string;
              };
              if (parsed.type) setType(parsed.type);
              if (parsed.accountId) setAccountId(parsed.accountId);
              if (parsed.categoryId) setCategoryId(parsed.categoryId);
            }
          } catch {
            // ignore malformed local storage
          }
        })
        .catch(() => {});
    }
  }, [open, contextPath]);

  const types = [
    { id: "expense" as const, label: "Expense", icon: ArrowDown, color: "text-destructive" },
    { id: "income" as const, label: "Income", icon: ArrowUp, color: "text-success" },
    { id: "transfer" as const, label: "Transfer", icon: ArrowLeftRight, color: "text-muted-foreground" },
  ];

  const categoryOptions = categories.filter((c) => {
    const ct = (c.type || "").toLowerCase().trim();
    if (type === "transfer") return true;
    if (type === "expense") {
      return ct.includes("expense") || ct.includes("debit") || !ct.includes("income");
    }
    return ct.includes("income") || ct.includes("credit");
  });

  const handleSubmit = async () => {
    if (!amount || parseFloat(amount) <= 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: parseFloat(amount),
          type,
          description: description || undefined,
          categoryId: categoryId || undefined,
          accountId: accountId || undefined,
          date,
        }),
      });
      if (!res.ok) throw new Error("Failed to add transaction");
      toast.success("Transaction added");
      setAmount("");
      setDescription("");
      setAccountId("");
      setCategoryId("");
      setDate(nowDateTimeInputValueIST());
      localStorage.setItem(
        "lifeos-expense-form-defaults",
        JSON.stringify({ type, accountId, categoryId })
      );
      onClose();
      router.refresh();
    } catch {
      toast.error("Failed to add transaction");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg bg-card rounded-t-2xl border-t border-border/50 shadow-xl pb-[env(safe-area-inset-bottom)]"
          >
            <div className="flex items-center justify-between p-4 pb-2">
              <h2 className="text-lg font-semibold">Quick Add</h2>
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-4 space-y-4 pb-4">
              {contextPath.startsWith("/investments") && (
                <div className="rounded-xl border border-border/40 p-3">
                  <p className="text-xs text-muted-foreground mb-2">
                    You are in Investments. Use quick actions:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        onClose();
                        router.push("/investments");
                      }}
                    >
                      Add Investment
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        onClose();
                        router.push("/sips");
                      }}
                    >
                      Add SIP
                    </Button>
                  </div>
                </div>
              )}
              <div className="flex gap-1.5 flex-wrap">
                {quickCategories.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className="px-2.5 py-1 rounded-full text-xs bg-muted text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      const match = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
                      if (name.toLowerCase() === "transfer") {
                        setType("transfer");
                        setCategoryId(match?.id || "");
                        return;
                      }
                      if (match) {
                        setType(match.type.toLowerCase().includes("income") ? "income" : "expense");
                        setCategoryId(match.id);
                        return;
                      }
                      setDescription((prev) => prev || name);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                {types.map((t) => {
                  const Icon = t.icon;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setType(t.id)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        type === t.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                      <span className="hidden xs:inline">{t.label}</span>
                      <span className="xs:hidden">{t.label.slice(0, 3)}</span>
                    </button>
                  );
                })}
              </div>

              <Input
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="text-3xl font-bold text-center h-16 border-0 bg-muted"
                inputMode="decimal"
              />

              <Input
                placeholder="What was this for?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />

              <div className="space-y-1.5">
                <label className="text-sm font-medium">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
                >
                  <option value="">Select category</option>
                  {categoryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {accounts.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Account</label>
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
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
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />

              <Button
                onClick={handleSubmit}
                disabled={loading || !amount}
                className="w-full h-12"
              >
                {loading ? "Adding..." : "Add Transaction"}
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
