"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Plus, Check, Circle, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatCurrency, formatDate, toDecimal } from "@/lib/utils";
import { toast } from "sonner";

interface Payment {
  id: string;
  month: number;
  amount: string;
  paid: boolean;
  paidDate: string | null;
}

interface Committee {
  id: string;
  name: string;
  totalAmount: string;
  monthlyAmount: string;
  totalMembers: number;
  startDate: string;
  duration: number;
  payoutMonth: number | null;
  status: string;
  payments: Payment[];
}

export default function CommitteesPage() {
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    totalAmount: "",
    monthlyAmount: "",
    totalMembers: "",
    startDate: "",
    duration: "",
    payoutMonth: "",
  });

  const fetchCommittees = async () => {
    const res = await fetch("/api/committees");
    const data = await res.json();
    setCommittees(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchCommittees();
  }, []);

  const handleAdd = async () => {
    if (!form.name || !form.monthlyAmount || !form.duration) return;
    await fetch("/api/committees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        totalAmount: parseFloat(form.totalAmount || form.monthlyAmount) * parseInt(form.duration),
        monthlyAmount: parseFloat(form.monthlyAmount),
        totalMembers: parseInt(form.totalMembers || form.duration),
        duration: parseInt(form.duration),
        payoutMonth: form.payoutMonth ? parseInt(form.payoutMonth) : null,
      }),
    });
    setShowAdd(false);
    setForm({ name: "", totalAmount: "", monthlyAmount: "", totalMembers: "", startDate: "", duration: "", payoutMonth: "" });
    fetchCommittees();
    toast.success("Committee added");
  };

  const togglePayment = async (committeeId: string, payment: Payment) => {
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

  if (loading) {
    return <div className="p-4"><div className="space-y-3">{Array.from({length: 2}).map((_, i) => <div key={i} className="h-40 rounded-2xl bg-muted animate-pulse" />)}</div></div>;
  }

  return (
    <div className="p-4 space-y-4">
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
          description="Track your chit funds and ROSCA contributions"
          action={<Button onClick={() => setShowAdd(true)} size="sm">Add Committee</Button>}
        />
      ) : (
        <div className="space-y-4">
          {committees.map((committee) => {
            const paidCount = committee.payments.filter((p) => p.paid).length;
            const totalPaid = committee.payments.filter((p) => p.paid).reduce((s, p) => s + toDecimal(p.amount), 0);
            const monthly = toDecimal(committee.monthlyAmount);
            const total = toDecimal(committee.totalAmount);
            const payout = committee.payoutMonth ? total : 0;
            const netBenefit = payout - totalPaid;

            return (
              <motion.div key={committee.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Users className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-sm font-semibold text-foreground">{committee.name}</CardTitle>
                          <p className="text-[10px] text-muted-foreground">
                            {formatCurrency(monthly)}/mo · {committee.duration} months
                          </p>
                        </div>
                      </div>
                      <Badge variant={committee.status === "active" ? "success" : "secondary"}>
                        {committee.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-3">
                      <div className="flex justify-between text-xs mb-1">
                        <span>{paidCount} of {committee.duration} paid</span>
                        <span>{formatCurrency(totalPaid)} / {formatCurrency(total)}</span>
                      </div>
                      <Progress value={paidCount} max={committee.duration} />
                    </div>
                    {committee.payoutMonth && (
                      <div className="flex items-center gap-1.5 mb-3 text-xs">
                        <AlertCircle className="w-3.5 h-3.5 text-warning" />
                        <span>Payout in month {committee.payoutMonth}</span>
                        <span className={`ml-auto font-medium ${netBenefit >= 0 ? "text-success" : "text-destructive"}`}>
                          Net: {formatCurrency(netBenefit)}
                        </span>
                      </div>
                    )}
                    <div className="grid grid-cols-6 gap-1.5">
                      {committee.payments.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => togglePayment(committee.id, p)}
                          className={`aspect-square rounded-lg flex items-center justify-center text-[10px] font-medium transition-all ${
                            p.paid
                              ? "bg-success/10 text-success"
                              : p.month === committee.payoutMonth
                                ? "bg-warning/10 text-warning border border-warning/30"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {p.paid ? <Check className="w-3.5 h-3.5" /> : p.month}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Committee">
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} placeholder="Family Chit Fund" />
          <Input label="Monthly Amount" type="number" value={form.monthlyAmount} onChange={(e) => setForm((p) => ({ ...p, monthlyAmount: e.target.value }))} inputMode="decimal" />
          <Input label="Duration (months)" type="number" value={form.duration} onChange={(e) => setForm((p) => ({ ...p, duration: e.target.value }))} />
          <Input label="Total Members" type="number" value={form.totalMembers} onChange={(e) => setForm((p) => ({ ...p, totalMembers: e.target.value }))} />
          <Input label="Your Payout Month" type="number" placeholder="Which month you receive" value={form.payoutMonth} onChange={(e) => setForm((p) => ({ ...p, payoutMonth: e.target.value }))} />
          <Input label="Start Date" type="date" value={form.startDate} onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))} />
          <Button onClick={handleAdd} className="w-full" disabled={!form.name || !form.monthlyAmount}>
            Add Committee
          </Button>
        </div>
      </Modal>
    </div>
  );
}
