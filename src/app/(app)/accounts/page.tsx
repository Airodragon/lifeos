"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CreditCard,
  Landmark,
  Wallet,
  Plus,
  Pencil,
  Trash2,
  PiggyBank,
  Building2,
  Banknote,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { nowDateInputValueIST, toDecimal } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { toast } from "sonner";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: string;
  creditLimit: string | null;
  currency: string;
  icon: string | null;
  color: string | null;
}

function getCreditCardUsed(account: Account): number {
  const balance = toDecimal(account.balance);
  const limit = toDecimal(account.creditLimit);
  if (limit > 0 && balance >= 0) {
    // Backward-compatible mode: balance stored as available credit (limit - used).
    return Math.max(0, limit - balance);
  }
  // Due-based mode: balance stored negative when used.
  return Math.max(0, -balance);
}

const ACCOUNT_TYPES = [
  { id: "bank", label: "Bank Account", icon: Landmark },
  { id: "cash", label: "Cash", icon: Banknote },
  { id: "wallet", label: "Digital Wallet", icon: Wallet },
  { id: "credit_card", label: "Credit Card", icon: CreditCard },
  { id: "savings", label: "Savings", icon: PiggyBank },
  { id: "other", label: "Other", icon: Building2 },
];

const TYPE_COLORS: Record<string, string> = {
  bank: "#3b82f6",
  cash: "#22c55e",
  wallet: "#8b5cf6",
  credit_card: "#ef4444",
  savings: "#f59e0b",
  other: "#6b7280",
};

const TYPE_ICONS: Record<string, typeof Landmark> = {
  bank: Landmark,
  cash: Banknote,
  wallet: Wallet,
  credit_card: CreditCard,
  savings: PiggyBank,
  other: Building2,
};

export default function AccountsPage() {
  const { fc: formatCurrency } = useFormat();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editAccount, setEditAccount] = useState<Account | null>(null);
  const [payCard, setPayCard] = useState<Account | null>(null);
  const [form, setForm] = useState({
    name: "",
    type: "bank",
    balance: "",
    creditLimit: "",
    color: "#3b82f6",
  });
  const [payForm, setPayForm] = useState({
    fromAccountId: "",
    amount: "",
    date: nowDateInputValueIST(),
    note: "",
  });

  const fetchAccounts = useCallback(async () => {
    const res = await fetch("/api/accounts");
    const data = await res.json();
    setAccounts(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handleAdd = async () => {
    if (!form.name) return;
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        balance: parseFloat(form.balance || "0"),
        creditLimit:
          form.type === "credit_card" && form.creditLimit
            ? parseFloat(form.creditLimit)
            : undefined,
        color: form.color,
      }),
    });
    setShowAdd(false);
    setForm({ name: "", type: "bank", balance: "", creditLimit: "", color: "#3b82f6" });
    fetchAccounts();
    toast.success("Account added");
  };

  const handleUpdate = async () => {
    if (!editAccount) return;
    await fetch(`/api/accounts/${editAccount.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        type: form.type,
        balance: parseFloat(form.balance || "0"),
        creditLimit:
          form.type === "credit_card" && form.creditLimit
            ? parseFloat(form.creditLimit)
            : null,
        color: form.color,
      }),
    });
    setEditAccount(null);
    setForm({ name: "", type: "bank", balance: "", creditLimit: "", color: "#3b82f6" });
    fetchAccounts();
    toast.success("Account updated");
  };

  const handlePayCreditCard = async () => {
    if (!payCard || !payForm.fromAccountId || !payForm.amount) return;
    const outstandingDue = getCreditCardUsed(payCard);
    const paymentAmount = parseFloat(payForm.amount);
    if (paymentAmount > outstandingDue) {
      toast.error(`Amount cannot exceed due (${formatCurrency(outstandingDue)})`);
      return;
    }
    if (outstandingDue <= 0) {
      toast.error("This card has no outstanding due");
      return;
    }
    const res = await fetch("/api/credit-cards/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        creditCardAccountId: payCard.id,
        fromAccountId: payForm.fromAccountId,
        amount: paymentAmount,
        date: payForm.date,
        note: payForm.note || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data?.error || "Payment failed");
      return;
    }
    toast.success("Credit card payment recorded");
    setPayCard(null);
    setPayForm({
      fromAccountId: "",
      amount: "",
      date: nowDateInputValueIST(),
      note: "",
    });
    fetchAccounts();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    fetchAccounts();
    toast.success("Account removed");
  };

  const openEdit = (account: Account) => {
    setEditAccount(account);
    setForm({
      name: account.name,
      type: account.type,
      balance: toDecimal(account.balance).toString(),
      creditLimit: account.creditLimit ? toDecimal(account.creditLimit).toString() : "",
      color: account.color || TYPE_COLORS[account.type] || "#3b82f6",
    });
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-28 w-full" />
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  const totalBalance = accounts.reduce((s, a) => s + toDecimal(a.balance), 0);

  const positiveBalance = accounts
    .filter((a) => a.type !== "credit_card")
    .reduce((s, a) => s + toDecimal(a.balance), 0);
  const creditBalance = accounts
    .filter((a) => a.type === "credit_card")
    .reduce((s, a) => {
      const bal = toDecimal(a.balance);
      return s + (bal < 0 ? Math.abs(bal) : 0);
    }, 0);

  return (
    <div className="p-4 space-y-4 pb-6">
      {/* Total Balance Hero */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0 overflow-hidden">
          <CardContent className="p-5">
            <p className="text-xs opacity-70 font-medium">Total Balance</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(totalBalance)}</p>
            <div className="flex gap-4 mt-3">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                </div>
                <div>
                  <p className="text-[10px] opacity-60">Available</p>
                  <p className="text-xs font-semibold">
                    {formatCurrency(positiveBalance, "INR", true)}
                  </p>
                </div>
              </div>
              {creditBalance > 0 && (
                <div className="flex items-center gap-1.5">
                  <div className="w-6 h-6 rounded-full bg-white/20 flex items-center justify-center">
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  </div>
                  <div>
                    <p className="text-[10px] opacity-60">Credit Due</p>
                    <p className="text-xs font-semibold">
                      {formatCurrency(creditBalance, "INR", true)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">Your Accounts</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {accounts.length === 0 ? (
        <EmptyState
          icon={<Landmark className="w-10 h-10" />}
          title="No accounts yet"
          description="Add your bank accounts, wallets, and credit cards"
          action={
            <Button onClick={() => setShowAdd(true)} size="sm">
              Add Account
            </Button>
          }
        />
      ) : (
        <AnimatePresence>
          <div className="space-y-3">
            {accounts.map((account) => {
              const Icon = TYPE_ICONS[account.type] || Building2;
              const balance = toDecimal(account.balance);
              const cardDue = account.type === "credit_card" ? getCreditCardUsed(account) : 0;
              const cardLimit = account.type === "credit_card" ? toDecimal(account.creditLimit) : 0;
              const cardAvailable = cardLimit > 0 ? Math.max(0, cardLimit - cardDue) : 0;
              const cardUtil = cardLimit > 0 ? (cardDue / cardLimit) * 100 : 0;
              const color = account.color || TYPE_COLORS[account.type] || "#6b7280";

              return (
                <motion.div
                  key={account.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                >
                  <Card className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-center gap-3 p-4">
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${color}15`, color }}
                        >
                          <Icon className="w-5 h-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{account.name}</p>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px]">
                              {ACCOUNT_TYPES.find((t) => t.id === account.type)?.label || account.type}
                            </Badge>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p
                            className={`text-base font-bold ${
                              account.type === "credit_card" && cardDue > 0
                                ? "text-destructive"
                                : balance >= 0
                                  ? "text-foreground"
                                  : "text-destructive"
                            }`}
                          >
                            {account.type === "credit_card"
                              ? `Due ${formatCurrency(cardDue)}`
                              : formatCurrency(balance)}
                          </p>
                        </div>
                      </div>
                      {account.type === "credit_card" && (
                        <div className="px-4 pb-3 text-xs text-muted-foreground space-y-1">
                          <div className="flex items-center justify-between">
                            <span>Limit</span>
                            <span className="font-medium">
                              {cardLimit > 0 ? formatCurrency(cardLimit) : "Not set"}
                            </span>
                          </div>
                          {cardLimit > 0 && (
                            <>
                              <div className="flex items-center justify-between">
                                <span>Available</span>
                                <span className="font-medium">{formatCurrency(cardAvailable)}</span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span>Utilization</span>
                                <span className="font-medium">{cardUtil.toFixed(1)}%</span>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      <div className="flex border-t border-border/30">
                        {account.type === "credit_card" && (
                          <>
                            <button
                              onClick={() => {
                                const due = getCreditCardUsed(account);
                                if (due <= 0) {
                                  toast.error("No due pending on this credit card");
                                  return;
                                }
                                setPayCard(account);
                                setPayForm((p) => ({ ...p, amount: due.toFixed(2) }));
                              }}
                              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-primary/80 hover:text-primary hover:bg-primary/5 transition-colors"
                            >
                              Pay Card
                            </button>
                            <div className="w-px bg-border/30" />
                          </>
                        )}
                        <button
                          onClick={() => openEdit(account)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
                        >
                          <Pencil className="w-3 h-3" /> Edit
                        </button>
                        <div className="w-px bg-border/30" />
                        <button
                          onClick={() => handleDelete(account.id)}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs text-destructive/60 hover:text-destructive hover:bg-destructive/5 transition-colors"
                        >
                          <Trash2 className="w-3 h-3" /> Remove
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

      {/* Add Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Account">
        <div className="space-y-4">
          <Input
            label="Account Name"
            placeholder="e.g., HDFC Savings"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Account Type</label>
            <div className="grid grid-cols-3 gap-2">
              {ACCOUNT_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() =>
                      setForm((p) => ({ ...p, type: type.id, color: TYPE_COLORS[type.id] || "#3b82f6" }))
                    }
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs font-medium transition-all ${
                      form.type === type.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {type.label.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>
          <Input
            label={form.type === "credit_card" ? "Available Credit" : "Current Balance"}
            type="number"
            placeholder={form.type === "credit_card" ? "e.g., 40000" : "0.00"}
            value={form.balance}
            onChange={(e) => setForm((p) => ({ ...p, balance: e.target.value }))}
            inputMode="decimal"
          />
          {form.type === "credit_card" && (
            <>
              <Input
                label="Credit Limit"
                type="number"
                placeholder="50000"
                value={form.creditLimit}
                onChange={(e) => setForm((p) => ({ ...p, creditLimit: e.target.value }))}
                inputMode="decimal"
              />
              <p className="text-xs text-muted-foreground">
                Enter available credit as current balance (limit - already used). Example: limit 50,000
                and used 10,000 means available 40,000.
              </p>
            </>
          )}
          <Button onClick={handleAdd} className="w-full" disabled={!form.name}>
            Add Account
          </Button>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editAccount} onClose={() => setEditAccount(null)} title="Edit Account">
        <div className="space-y-4">
          <Input
            label="Account Name"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Account Type</label>
            <div className="grid grid-cols-3 gap-2">
              {ACCOUNT_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() =>
                      setForm((p) => ({ ...p, type: type.id, color: TYPE_COLORS[type.id] || "#3b82f6" }))
                    }
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl text-xs font-medium transition-all ${
                      form.type === type.id
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {type.label.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>
          <Input
            label={form.type === "credit_card" ? "Available Credit" : "Current Balance"}
            type="number"
            value={form.balance}
            onChange={(e) => setForm((p) => ({ ...p, balance: e.target.value }))}
            inputMode="decimal"
          />
          {form.type === "credit_card" && (
            <Input
              label="Credit Limit"
              type="number"
              value={form.creditLimit}
              onChange={(e) => setForm((p) => ({ ...p, creditLimit: e.target.value }))}
              inputMode="decimal"
            />
          )}
          <Button onClick={handleUpdate} className="w-full" disabled={!form.name}>
            Update Account
          </Button>
        </div>
      </Modal>

      <Modal
        open={!!payCard}
        onClose={() => setPayCard(null)}
        title={payCard ? `Pay ${payCard.name}` : "Pay Credit Card"}
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-muted p-3 text-xs text-muted-foreground">
            Outstanding due:{" "}
            <span className="font-semibold text-foreground">
              {formatCurrency(payCard ? Math.max(0, -toDecimal(payCard.balance)) : 0)}
            </span>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Pay from account</label>
            <select
              value={payForm.fromAccountId}
              onChange={(e) => setPayForm((p) => ({ ...p, fromAccountId: e.target.value }))}
              className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
            >
              <option value="">Select account</option>
              {accounts
                .filter((a) => a.type !== "credit_card" && (!payCard || a.id !== payCard.id))
                .map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
            </select>
          </div>
          <Input
            label="Amount"
            type="number"
            value={payForm.amount}
            onChange={(e) => setPayForm((p) => ({ ...p, amount: e.target.value }))}
            inputMode="decimal"
            max={payCard ? getCreditCardUsed(payCard) : undefined}
          />
          <p className="text-xs text-muted-foreground">
            Max payable: {formatCurrency(payCard ? getCreditCardUsed(payCard) : 0)}
          </p>
          <Input
            label="Payment date"
            type="date"
            value={payForm.date}
            onChange={(e) => setPayForm((p) => ({ ...p, date: e.target.value }))}
          />
          <Input
            label="Note (optional)"
            value={payForm.note}
            onChange={(e) => setPayForm((p) => ({ ...p, note: e.target.value }))}
          />
          <Button
            className="w-full"
            onClick={handlePayCreditCard}
            disabled={
              !payForm.fromAccountId ||
              !payForm.amount ||
              parseFloat(payForm.amount || "0") >
                (payCard ? getCreditCardUsed(payCard) : 0)
            }
          >
            Pay Credit Card
          </Button>
        </div>
      </Modal>
    </div>
  );
}
