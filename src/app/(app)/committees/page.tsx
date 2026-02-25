"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Plus,
  Check,
  Calendar,
  IndianRupee,
  Trash2,
  ChevronDown,
  ChevronUp,
  Bell,
  CheckCircle2,
  Clock,
  Pencil,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate, nowDateInputValueIST, toDecimal } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { toast } from "sonner";

interface Payment {
  id: string;
  month: number;
  amount: string | null;
  paid: boolean;
  paidDate: string | null;
}

interface Committee {
  id: string;
  name: string;
  payoutAmount: string;
  totalMembers: number;
  startDate: string;
  paymentDay: number;
  duration: number;
  status: string;
  notes: string | null;
  payments: Payment[];
}

export default function CommitteesPage() {
  const { fc: formatCurrency } = useFormat();
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingPayment, setEditingPayment] = useState<{ committeeId: string; payment: Payment } | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [form, setForm] = useState({
    name: "",
    payoutAmount: "",
    duration: "15",
    totalMembers: "15",
    paymentDay: "1",
    startDate: nowDateInputValueIST(),
    notes: "",
  });

  const fetchCommittees = useCallback(async () => {
    const res = await fetch("/api/committees");
    const data = await res.json();
    setCommittees(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCommittees();
  }, [fetchCommittees]);

  const handleAdd = async () => {
    if (!form.name || !form.payoutAmount || !form.duration) return;
    await fetch("/api/committees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.name,
        payoutAmount: parseFloat(form.payoutAmount),
        duration: parseInt(form.duration),
        totalMembers: parseInt(form.totalMembers || form.duration),
        paymentDay: parseInt(form.paymentDay || "1"),
        startDate: form.startDate,
        notes: form.notes || null,
      }),
    });
    setShowAdd(false);
    setForm({ name: "", payoutAmount: "", duration: "15", totalMembers: "15", paymentDay: "1", startDate: nowDateInputValueIST(), notes: "" });
    fetchCommittees();
    toast.success("Committee added");
  };

  const handleSetAmount = async (committeeId: string, payment: Payment, amount: number) => {
    await fetch(`/api/committees/${committeeId}/payments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentId: payment.id,
        amount,
      }),
    });
    fetchCommittees();
  };

  const togglePayment = async (committeeId: string, payment: Payment) => {
    if (!payment.amount && !payment.paid) {
      setEditingPayment({ committeeId, payment });
      setEditAmount("");
      return;
    }
    await fetch(`/api/committees/${committeeId}/payments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentId: payment.id,
        paid: !payment.paid,
      }),
    });
    fetchCommittees();
  };

  const handlePayAndSetAmount = async () => {
    if (!editingPayment || !editAmount) return;
    const amount = parseFloat(editAmount);
    await fetch(`/api/committees/${editingPayment.committeeId}/payments`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentId: editingPayment.payment.id,
        amount,
        paid: true,
      }),
    });
    setEditingPayment(null);
    setEditAmount("");
    fetchCommittees();
    toast.success("Payment recorded");
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/committees/${id}`, { method: "DELETE" });
    fetchCommittees();
    toast.success("Committee removed");
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  const totalPaidAll = committees.reduce((s, c) => {
    return s + c.payments.filter((p) => p.paid).reduce((ps, p) => ps + toDecimal(p.amount), 0);
  }, 0);
  const totalPayoutAll = committees.reduce((s, c) => s + toDecimal(c.payoutAmount), 0);

  // Upcoming payments across all committees
  const today = new Date();
  const currentDay = today.getDate();
  const upcomingPayments = committees
    .filter((c) => c.status === "active")
    .flatMap((c) => {
      const nextUnpaid = c.payments.find((p) => !p.paid);
      if (!nextUnpaid) return [];
      const daysUntil = c.paymentDay >= currentDay
        ? c.paymentDay - currentDay
        : 30 - currentDay + c.paymentDay;
      return [{ committee: c, payment: nextUnpaid, daysUntil }];
    })
    .sort((a, b) => a.daysUntil - b.daysUntil);

  return (
    <div className="p-4 space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Committees</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {committees.length === 0 ? (
        <EmptyState
          icon={<Users className="w-10 h-10" />}
          title="No committees"
          description="Track your chit funds with variable monthly payments"
          action={<Button onClick={() => setShowAdd(true)} size="sm">Add Committee</Button>}
        />
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground">Total Paid</p>
                <p className="text-base font-bold">{formatCurrency(totalPaidAll, "INR", true)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-3">
                <p className="text-[10px] text-muted-foreground">Total Payout</p>
                <p className="text-base font-bold text-success">{formatCurrency(totalPayoutAll, "INR", true)}</p>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming Payments Alert */}
          {upcomingPayments.length > 0 && (
            <Card className="border-warning/30">
              <CardContent className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Bell className="w-4 h-4 text-warning" />
                  <p className="text-xs font-medium">Upcoming Payments</p>
                </div>
                <div className="space-y-1.5">
                  {upcomingPayments.map((up) => (
                    <div key={up.committee.id} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">
                        {up.committee.name} — Month {up.payment.month}
                      </span>
                      <div className="flex items-center gap-2">
                        {up.payment.amount ? (
                          <span className="font-medium">{formatCurrency(toDecimal(up.payment.amount))}</span>
                        ) : (
                          <Badge variant="secondary">TBD</Badge>
                        )}
                        <span className="text-[10px] text-muted-foreground">
                          {up.daysUntil === 0 ? "Today" : `${up.daysUntil}d`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Committee Cards */}
          <AnimatePresence>
            <div className="space-y-4">
              {committees.map((committee) => {
                const paidPayments = committee.payments.filter((p) => p.paid);
                const totalPaid = paidPayments.reduce((s, p) => s + toDecimal(p.amount), 0);
                const payout = toDecimal(committee.payoutAmount);
                const profit = payout - totalPaid;
                const isExpanded = expandedId === committee.id;
                const paidCount = paidPayments.length;
                const isComplete = paidCount === committee.duration;

                // Calculate estimated monthly (avg of paid or total payout / duration)
                const avgMonthly = paidCount > 0
                  ? totalPaid / paidCount
                  : payout / committee.duration;
                const estimatedTotal = avgMonthly * committee.duration;
                const estimatedProfit = payout - estimatedTotal;

                // Next payment due
                const nextPayment = committee.payments.find((p) => !p.paid);
                const monthStart = new Date(committee.startDate);

                return (
                  <motion.div
                    key={committee.id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -100 }}
                  >
                    <Card className={isComplete ? "border-success/30" : ""}>
                      <CardContent className="p-4">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isComplete ? "bg-success/10" : "bg-orange-500/10"}`}>
                              {isComplete ? (
                                <CheckCircle2 className="w-5 h-5 text-success" />
                              ) : (
                                <Users className="w-5 h-5 text-orange-500" />
                              )}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-semibold truncate">{committee.name}</p>
                              <p className="text-[10px] text-muted-foreground">
                                {committee.duration} months · Day {committee.paymentDay}
                              </p>
                            </div>
                          </div>
                          <Badge variant={isComplete ? "success" : committee.status === "active" ? "default" : "secondary"} className="shrink-0">
                            {isComplete ? "Complete" : committee.status}
                          </Badge>
                        </div>

                        {/* Key Numbers */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-center mb-3">
                          <div>
                            <p className="text-[10px] text-muted-foreground">Paid</p>
                            <p className="text-xs font-semibold">{formatCurrency(totalPaid, "INR", true)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">Payout</p>
                            <p className="text-xs font-semibold text-success">{formatCurrency(payout, "INR", true)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground">{isComplete ? "Profit" : "Est. Profit"}</p>
                            <p className={`text-xs font-semibold ${(isComplete ? profit : estimatedProfit) >= 0 ? "text-success" : "text-destructive"}`}>
                              {formatCurrency(isComplete ? profit : estimatedProfit, "INR", true)}
                            </p>
                          </div>
                        </div>

                        {/* Progress */}
                        <div className="mb-3">
                          <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                            <span>{paidCount} of {committee.duration} months paid</span>
                            <span>{committee.duration - paidCount} remaining</span>
                          </div>
                          <Progress value={paidCount} max={committee.duration} />
                        </div>

                        {/* Payment Grid - Collapsed/Expanded */}
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : committee.id)}
                          className="w-full flex items-center justify-center gap-1 text-xs text-muted-foreground py-1 hover:text-foreground transition-colors"
                        >
                          {isExpanded ? "Hide" : "Show"} monthly details
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </button>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="space-y-1.5 pt-2">
                                {committee.payments.map((p) => {
                                  const monthDate = new Date(monthStart);
                                  monthDate.setMonth(monthDate.getMonth() + p.month - 1);
                                  const monthName = monthDate.toLocaleDateString("en-IN", {
                                    month: "short",
                                    year: "2-digit",
                                    timeZone: "Asia/Kolkata",
                                  });

                                  return (
                                    <div
                                      key={p.id}
                                      className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                                        p.paid
                                          ? "bg-success/5"
                                          : nextPayment?.id === p.id
                                            ? "bg-warning/5 border border-warning/20"
                                            : "bg-muted/40"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => togglePayment(committee.id, p)}
                                          className={`w-6 h-6 rounded-full flex items-center justify-center ${
                                            p.paid
                                              ? "bg-success text-white"
                                              : "border-2 border-muted-foreground/30"
                                          }`}
                                        >
                                          {p.paid && <Check className="w-3.5 h-3.5" />}
                                        </button>
                                        <div>
                                          <p className="text-xs font-medium">Month {p.month}</p>
                                          <p className="text-[10px] text-muted-foreground">{monthName}</p>
                                        </div>
                                      </div>

                                      <div className="flex items-center gap-2">
                                        {p.amount ? (
                                          <span className="text-xs font-semibold">
                                            {formatCurrency(toDecimal(p.amount))}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-muted-foreground italic">Amount TBD</span>
                                        )}

                                        {!p.paid && (
                                          <button
                                            onClick={() => {
                                              setEditingPayment({ committeeId: committee.id, payment: p });
                                              setEditAmount(p.amount ? toDecimal(p.amount).toString() : "");
                                            }}
                                            className="p-1 rounded-md hover:bg-muted text-muted-foreground"
                                          >
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                        )}

                                        {p.paid && p.paidDate && (
                                          <span className="text-[10px] text-muted-foreground">
                                            {formatDate(p.paidDate)}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
                          <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            Started {formatDate(committee.startDate)}
                          </span>
                          <button
                            onClick={() => handleDelete(committee.id)}
                            className="p-1.5 rounded-lg text-destructive/50 hover:text-destructive hover:bg-destructive/5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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

      {/* Add Committee Modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Committee">
        <div className="space-y-4">
          <Input
            label="Committee Name"
            placeholder="e.g., Family Chit Fund"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <Input
            label="Final Payout Amount"
            type="number"
            placeholder="e.g., 150000"
            value={form.payoutAmount}
            onChange={(e) => setForm((p) => ({ ...p, payoutAmount: e.target.value }))}
            inputMode="decimal"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Duration (months)"
              type="number"
              value={form.duration}
              onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))}
              inputMode="numeric"
            />
            <Input
              label="Payment Day"
              type="number"
              placeholder="Day of month"
              value={form.paymentDay}
              onChange={(e) => setForm((p) => ({ ...p, paymentDay: e.target.value }))}
              inputMode="numeric"
            />
          </div>
          <Input
            label="Total Members"
            type="number"
            value={form.totalMembers}
            onChange={(e) => setForm((p) => ({ ...p, totalMembers: e.target.value }))}
            inputMode="numeric"
          />
          <Input
            label="Start Date"
            type="date"
            value={form.startDate}
            onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
          />
          <Input
            label="Notes (optional)"
            placeholder="Any additional info"
            value={form.notes}
            onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
          />

          {/* Preview */}
          {form.payoutAmount && form.duration && (
            <div className="bg-muted/50 rounded-xl p-3">
              <p className="text-xs font-medium mb-1">Preview</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-[10px] text-muted-foreground">Payout</p>
                  <p className="font-semibold">{formatCurrency(parseFloat(form.payoutAmount || "0"))}</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">Avg/month (if equal)</p>
                  <p className="font-semibold">
                    ~{formatCurrency(parseFloat(form.payoutAmount || "0") / parseInt(form.duration || "1"))}
                  </p>
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleAdd}
            className="w-full"
            disabled={!form.name || !form.payoutAmount || !form.duration}
          >
            Add Committee
          </Button>
        </div>
      </Modal>

      {/* Payment Amount Modal */}
      <Modal
        open={!!editingPayment}
        onClose={() => setEditingPayment(null)}
        title={editingPayment ? `Month ${editingPayment.payment.month} Payment` : "Payment"}
      >
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Enter the amount for this month&apos;s payment. Each month can have a different amount.
          </p>
          <Input
            label="Payment Amount"
            type="number"
            placeholder="e.g., 10000"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            inputMode="decimal"
            autoFocus
          />
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              onClick={async () => {
                if (!editingPayment || !editAmount) return;
                await handleSetAmount(
                  editingPayment.committeeId,
                  editingPayment.payment,
                  parseFloat(editAmount)
                );
                setEditingPayment(null);
                setEditAmount("");
                toast.success("Amount set");
              }}
              disabled={!editAmount}
            >
              Set Amount Only
            </Button>
            <Button
              onClick={handlePayAndSetAmount}
              disabled={!editAmount}
            >
              <Check className="w-4 h-4 mr-1" /> Pay & Mark Done
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
