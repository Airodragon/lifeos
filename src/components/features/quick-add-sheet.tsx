"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, ArrowDown, ArrowUp, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface Account {
  id: string;
  name: string;
  type: string;
}

interface QuickAddSheetProps {
  open: boolean;
  onClose: () => void;
}

export function QuickAddSheet({ open, onClose }: QuickAddSheetProps) {
  const router = useRouter();
  const [type, setType] = useState<"expense" | "income" | "transfer">("expense");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [accountId, setAccountId] = useState("");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetch("/api/accounts")
        .then((r) => r.json())
        .then((data) => setAccounts(data || []))
        .catch(() => {});
    }
  }, [open]);

  const types = [
    { id: "expense" as const, label: "Expense", icon: ArrowDown, color: "text-destructive" },
    { id: "income" as const, label: "Income", icon: ArrowUp, color: "text-success" },
    { id: "transfer" as const, label: "Transfer", icon: ArrowLeftRight, color: "text-muted-foreground" },
  ];

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
          accountId: accountId || undefined,
          date: new Date().toISOString(),
        }),
      });
      if (!res.ok) throw new Error("Failed to add transaction");
      toast.success("Transaction added");
      setAmount("");
      setDescription("");
      setAccountId("");
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
