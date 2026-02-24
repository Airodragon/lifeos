"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BellRing,
  Plus,
  CalendarClock,
  Pause,
  Play,
  SkipForward,
  CheckCircle2,
  Pencil,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { nowDateInputValueIST, toDateInputValueIST, toDecimal } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { toast } from "sonner";

type Cadence = "monthly" | "yearly" | "one_time";

interface Account {
  id: string;
  name: string;
  type: string;
}

interface Subscription {
  id: string;
  name: string;
  merchant: string | null;
  amount: string;
  currency: string;
  cadence: Cadence;
  nextDueDate: string;
  endDate: string | null;
  remindDaysBefore: number;
  active: boolean;
  category: string | null;
  paymentMethodLabel: string | null;
  notes: string | null;
  paymentAccountId: string | null;
  paymentAccount: Account | null;
}

const CADENCE_OPTIONS: Array<{ id: Cadence; label: string }> = [
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
  { id: "one_time", label: "One-time" },
];

function cadenceLabel(cadence: Cadence) {
  return CADENCE_OPTIONS.find((x) => x.id === cadence)?.label || cadence;
}

function dayDiffFromToday(dueDate: string) {
  const today = new Date(toDateInputValueIST(new Date()));
  const due = new Date(toDateInputValueIST(dueDate));
  return Math.round((due.getTime() - today.getTime()) / 86400000);
}

export default function SubscriptionsPage() {
  const { fc: formatCurrency } = useFormat();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editSubscription, setEditSubscription] = useState<Subscription | null>(null);
  const [form, setForm] = useState({
    name: "",
    merchant: "",
    amount: "",
    currency: "INR",
    cadence: "monthly" as Cadence,
    nextDueDate: nowDateInputValueIST(),
    endDate: "",
    paymentAccountId: "",
    paymentMethodLabel: "",
    remindDaysBefore: "1",
    category: "",
    notes: "",
    active: true,
  });

  const fetchData = useCallback(async () => {
    const [subRes, accRes] = await Promise.all([fetch("/api/subscriptions"), fetch("/api/accounts")]);
    const [subData, accData] = await Promise.all([subRes.json(), accRes.json()]);
    setSubscriptions(Array.isArray(subData) ? subData : []);
    setAccounts(Array.isArray(accData) ? accData : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setForm({
      name: "",
      merchant: "",
      amount: "",
      currency: "INR",
      cadence: "monthly",
      nextDueDate: nowDateInputValueIST(),
      endDate: "",
      paymentAccountId: "",
      paymentMethodLabel: "",
      remindDaysBefore: "1",
      category: "",
      notes: "",
      active: true,
    });
  };

  const handleAdd = async () => {
    if (!form.name || !form.amount || !form.nextDueDate) return;
    setSaving(true);
    const res = await fetch("/api/subscriptions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        merchant: form.merchant || undefined,
        amount: parseFloat(form.amount),
        currency: form.currency || "INR",
        cadence: form.cadence,
        nextDueDate: form.nextDueDate,
        endDate: form.endDate || null,
        paymentAccountId: form.paymentAccountId || null,
        paymentMethodLabel: form.paymentMethodLabel || undefined,
        remindDaysBefore: Math.max(0, parseInt(form.remindDaysBefore || "1", 10)),
        category: form.category || undefined,
        notes: form.notes || undefined,
        active: form.active,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || "Could not create subscription");
      return;
    }
    toast.success("Subscription added");
    setShowAdd(false);
    resetForm();
    fetchData();
  };

  const openEdit = (sub: Subscription) => {
    setEditSubscription(sub);
    setForm({
      name: sub.name,
      merchant: sub.merchant || "",
      amount: toDecimal(sub.amount).toString(),
      currency: sub.currency || "INR",
      cadence: sub.cadence,
      nextDueDate: toDateInputValueIST(sub.nextDueDate),
      endDate: sub.endDate ? toDateInputValueIST(sub.endDate) : "",
      paymentAccountId: sub.paymentAccountId || "",
      paymentMethodLabel: sub.paymentMethodLabel || "",
      remindDaysBefore: String(sub.remindDaysBefore ?? 1),
      category: sub.category || "",
      notes: sub.notes || "",
      active: sub.active,
    });
  };

  const handleEditSave = async () => {
    if (!editSubscription || !form.name || !form.amount || !form.nextDueDate) return;
    setSaving(true);
    const res = await fetch(`/api/subscriptions/${editSubscription.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        merchant: form.merchant || null,
        amount: parseFloat(form.amount),
        currency: form.currency || "INR",
        cadence: form.cadence,
        nextDueDate: form.nextDueDate,
        endDate: form.endDate || null,
        paymentAccountId: form.paymentAccountId || null,
        paymentMethodLabel: form.paymentMethodLabel || null,
        remindDaysBefore: Math.max(0, parseInt(form.remindDaysBefore || "1", 10)),
        category: form.category || null,
        notes: form.notes || null,
        active: form.active,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      toast.error(data?.error || "Could not update subscription");
      return;
    }
    toast.success("Subscription updated");
    setEditSubscription(null);
    resetForm();
    fetchData();
  };

  const runAction = async (sub: Subscription, action: "mark_paid" | "skip" | "pause" | "resume") => {
    const res = await fetch(`/api/subscriptions/${sub.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    if (!res.ok) {
      toast.error("Action failed");
      return;
    }
    toast.success(
      action === "mark_paid"
        ? "Marked paid"
        : action === "skip"
          ? "Skipped to next cycle"
          : action === "pause"
            ? "Paused"
            : "Resumed"
    );
    fetchData();
  };

  const removeSubscription = async (sub: Subscription) => {
    const res = await fetch(`/api/subscriptions/${sub.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Could not delete subscription");
      return;
    }
    toast.success("Subscription removed");
    fetchData();
  };

  const groups = useMemo(() => {
    const active = subscriptions.filter((s) => s.active);
    const overdue = active.filter((s) => dayDiffFromToday(s.nextDueDate) < 0);
    const dueSoon = active.filter((s) => {
      const d = dayDiffFromToday(s.nextDueDate);
      return d >= 0 && d <= s.remindDaysBefore;
    });
    const later = active.filter((s) => dayDiffFromToday(s.nextDueDate) > s.remindDaysBefore);
    return { overdue, dueSoon, later, inactive: subscriptions.filter((s) => !s.active) };
  }, [subscriptions]);

  const summary = useMemo(() => {
    const active = subscriptions.filter((s) => s.active);
    const monthlyEquivalent = active.reduce((sum, sub) => {
      const amount = toDecimal(sub.amount);
      if (sub.cadence === "yearly") return sum + amount / 12;
      if (sub.cadence === "one_time") return sum + amount / 12;
      return sum + amount;
    }, 0);
    const upcoming = active
      .map((s) => dayDiffFromToday(s.nextDueDate))
      .filter((d) => d >= 0)
      .sort((a, b) => a - b)[0];
    return { activeCount: active.length, monthlyEquivalent, nextDueInDays: upcoming };
  }, [subscriptions]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Subscriptions Manager</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <Card>
          <CardContent className="p-2.5">
            <p className="text-muted-foreground">Active</p>
            <p className="font-semibold">{summary.activeCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5">
            <p className="text-muted-foreground">Monthly Eq.</p>
            <p className="font-semibold">{formatCurrency(summary.monthlyEquivalent, "INR", true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-2.5">
            <p className="text-muted-foreground">Upcoming</p>
            <p className="font-semibold">
              {summary.nextDueInDays === undefined
                ? "—"
                : summary.nextDueInDays === 0
                  ? "Today"
                  : `${summary.nextDueInDays}d`}
            </p>
          </CardContent>
        </Card>
      </div>

      {subscriptions.length === 0 ? (
        <EmptyState
          icon={<BellRing className="w-10 h-10" />}
          title="No subscriptions"
          description="Track recurring monthly, yearly and one-time renewals with reminders."
          action={
            <Button onClick={() => setShowAdd(true)} size="sm">
              Add Subscription
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {[
            { title: "Overdue", rows: groups.overdue },
            { title: "Due Soon", rows: groups.dueSoon },
            { title: "Later", rows: groups.later },
            { title: "Inactive", rows: groups.inactive },
          ].map((section) => (
            <div key={section.title}>
              <p className="text-xs font-medium text-muted-foreground mb-2 px-1">{section.title}</p>
              {section.rows.length === 0 ? (
                <Card>
                  <CardContent className="p-3 text-xs text-muted-foreground">No items</CardContent>
                </Card>
              ) : (
                <AnimatePresence>
                  <div className="space-y-2">
                    {section.rows.map((sub) => {
                      const diff = dayDiffFromToday(sub.nextDueDate);
                      return (
                        <motion.div
                          key={sub.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -100 }}
                        >
                          <Card>
                            <CardContent className="p-3 space-y-2">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                  <p className="text-sm font-semibold truncate">{sub.name}</p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {sub.merchant || "No merchant"} · {cadenceLabel(sub.cadence)}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground truncate">
                                    {sub.paymentAccount?.name || sub.paymentMethodLabel || "No payment account"}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-sm font-semibold">
                                    {formatCurrency(toDecimal(sub.amount))}
                                  </p>
                                  <Badge
                                    variant={
                                      !sub.active
                                        ? "secondary"
                                        : diff < 0
                                          ? "destructive"
                                          : diff === 0
                                            ? "warning"
                                            : "secondary"
                                    }
                                  >
                                    {!sub.active
                                      ? "Paused"
                                      : diff < 0
                                        ? `Overdue ${Math.abs(diff)}d`
                                        : diff === 0
                                          ? "Due today"
                                          : `Due in ${diff}d`}
                                  </Badge>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                <CalendarClock className="w-3 h-3" />
                                <span>
                                  Due: {toDateInputValueIST(sub.nextDueDate)} · Remind {sub.remindDaysBefore}d before
                                </span>
                              </div>
                              <div className="grid grid-cols-4 gap-1.5">
                                <button
                                  onClick={() => runAction(sub, "mark_paid")}
                                  className="rounded-lg bg-success/10 text-success text-[11px] py-1.5 font-medium"
                                >
                                  <CheckCircle2 className="w-3 h-3 inline mr-1" />
                                  Paid
                                </button>
                                <button
                                  onClick={() => runAction(sub, "skip")}
                                  className="rounded-lg bg-muted text-muted-foreground text-[11px] py-1.5 font-medium"
                                >
                                  <SkipForward className="w-3 h-3 inline mr-1" />
                                  Skip
                                </button>
                                <button
                                  onClick={() => runAction(sub, sub.active ? "pause" : "resume")}
                                  className="rounded-lg bg-muted text-muted-foreground text-[11px] py-1.5 font-medium"
                                >
                                  {sub.active ? (
                                    <Pause className="w-3 h-3 inline mr-1" />
                                  ) : (
                                    <Play className="w-3 h-3 inline mr-1" />
                                  )}
                                  {sub.active ? "Pause" : "Resume"}
                                </button>
                                <div className="flex items-center justify-end gap-1">
                                  <button
                                    onClick={() => openEdit(sub)}
                                    className="rounded-lg bg-muted p-1.5 text-muted-foreground"
                                  >
                                    <Pencil className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => removeSubscription(sub)}
                                    className="rounded-lg bg-destructive/10 p-1.5 text-destructive"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </motion.div>
                      );
                    })}
                  </div>
                </AnimatePresence>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Subscription">
        <SubscriptionForm
          form={form}
          setForm={setForm}
          accounts={accounts}
          loading={saving}
          onSubmit={handleAdd}
          submitText="Add Subscription"
        />
      </Modal>

      <Modal open={!!editSubscription} onClose={() => setEditSubscription(null)} title="Edit Subscription">
        <SubscriptionForm
          form={form}
          setForm={setForm}
          accounts={accounts}
          loading={saving}
          onSubmit={handleEditSave}
          submitText="Save Changes"
        />
      </Modal>
    </div>
  );
}

function SubscriptionForm({
  form,
  setForm,
  accounts,
  loading,
  onSubmit,
  submitText,
}: {
  form: {
    name: string;
    merchant: string;
    amount: string;
    currency: string;
    cadence: Cadence;
    nextDueDate: string;
    endDate: string;
    paymentAccountId: string;
    paymentMethodLabel: string;
    remindDaysBefore: string;
    category: string;
    notes: string;
    active: boolean;
  };
  setForm: React.Dispatch<
    React.SetStateAction<{
      name: string;
      merchant: string;
      amount: string;
      currency: string;
      cadence: Cadence;
      nextDueDate: string;
      endDate: string;
      paymentAccountId: string;
      paymentMethodLabel: string;
      remindDaysBefore: string;
      category: string;
      notes: string;
      active: boolean;
    }>
  >;
  accounts: Account[];
  loading: boolean;
  onSubmit: () => void;
  submitText: string;
}) {
  return (
    <div className="space-y-4">
      <Input
        label="Name"
        value={form.name}
        onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
        placeholder="e.g., Netflix Premium"
      />
      <Input
        label="Merchant (optional)"
        value={form.merchant}
        onChange={(e) => setForm((p) => ({ ...p, merchant: e.target.value }))}
        placeholder="e.g., Netflix"
      />
      <Input
        label="Amount"
        type="number"
        value={form.amount}
        onChange={(e) => setForm((p) => ({ ...p, amount: e.target.value }))}
        inputMode="decimal"
      />
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Cadence</label>
        <select
          value={form.cadence}
          onChange={(e) => setForm((p) => ({ ...p, cadence: e.target.value as Cadence }))}
          className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
        >
          {CADENCE_OPTIONS.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          label="Next due date"
          type="date"
          value={form.nextDueDate}
          onChange={(e) => setForm((p) => ({ ...p, nextDueDate: e.target.value }))}
        />
        <Input
          label="End date (optional)"
          type="date"
          value={form.endDate}
          onChange={(e) => setForm((p) => ({ ...p, endDate: e.target.value }))}
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-medium">Pay from account (optional)</label>
        <select
          value={form.paymentAccountId}
          onChange={(e) => setForm((p) => ({ ...p, paymentAccountId: e.target.value }))}
          className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
        >
          <option value="">Select account</option>
          {accounts.map((acc) => (
            <option key={acc.id} value={acc.id}>
              {acc.name}
            </option>
          ))}
        </select>
      </div>
      <Input
        label="Payment method label (optional)"
        value={form.paymentMethodLabel}
        onChange={(e) => setForm((p) => ({ ...p, paymentMethodLabel: e.target.value }))}
        placeholder="e.g., HDFC Card ending 1234"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input
          label="Remind days before"
          type="number"
          value={form.remindDaysBefore}
          onChange={(e) => setForm((p) => ({ ...p, remindDaysBefore: e.target.value }))}
          inputMode="numeric"
        />
        <Input
          label="Category (optional)"
          value={form.category}
          onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
        />
      </div>
      <Input
        label="Notes (optional)"
        value={form.notes}
        onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
      />
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={form.active}
          onChange={(e) => setForm((p) => ({ ...p, active: e.target.checked }))}
          className="w-4 h-4 rounded accent-primary"
        />
        Active
      </label>
      <Button onClick={onSubmit} className="w-full" disabled={loading || !form.name || !form.amount}>
        {loading ? "Saving..." : submitText}
      </Button>
    </div>
  );
}
