"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Target, Plus, Trophy, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressRing } from "@/components/charts/progress-ring";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toDecimal } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { toast } from "sonner";
import { triggerHaptic } from "@/lib/haptics";

interface Goal {
  id: string;
  name: string;
  targetAmount: string;
  currentAmount: string;
  deadline: string | null;
  icon: string | null;
  color: string | null;
  status: string;
}

interface GoalProjection {
  goalId: string;
  monthlyRequired: number;
  monthsLeft: number;
  projectedAtDeadline: number;
  probability: number;
  status: "on_track" | "at_risk" | "off_track";
}

const GOAL_COLORS = ["#22c55e", "#3b82f6", "#f97316", "#8b5cf6", "#ec4899", "#14b8a6", "#eab308"];

export default function GoalsPage() {
  const { fc: formatCurrency } = useFormat();
  const [renderNowTs] = useState(() => Date.now());
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showUpdate, setShowUpdate] = useState<Goal | null>(null);
  const [updateAmount, setUpdateAmount] = useState("");
  const [projectionMap, setProjectionMap] = useState<Record<string, GoalProjection>>({});
  const [form, setForm] = useState({
    name: "",
    targetAmount: "",
    currentAmount: "0",
    deadline: "",
    color: GOAL_COLORS[0],
  });

  const fetchGoals = async () => {
    const [res, projectionRes] = await Promise.all([
      fetch("/api/goals"),
      fetch("/api/goals/projections"),
    ]);
    const data = await res.json();
    const projectionData = await projectionRes.json();
    const map: Record<string, GoalProjection> = {};
    for (const p of projectionData.projections || []) {
      map[p.goalId] = p;
    }
    setProjectionMap(map);
    setGoals(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchGoals();
  }, []);

  const handleAdd = async () => {
    if (!form.name || !form.targetAmount) return;
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        targetAmount: parseFloat(form.targetAmount),
        currentAmount: parseFloat(form.currentAmount || "0"),
        deadline: form.deadline || null,
      }),
    });
    setShowAdd(false);
    setForm({ name: "", targetAmount: "", currentAmount: "0", deadline: "", color: GOAL_COLORS[0] });
    fetchGoals();
    toast.success("Goal created");
    triggerHaptic("success");
  };

  const handleUpdate = async () => {
    if (!showUpdate || !updateAmount) return;
    await fetch(`/api/goals/${showUpdate.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentAmount: toDecimal(showUpdate.currentAmount) + parseFloat(updateAmount),
      }),
    });
    setShowUpdate(null);
    setUpdateAmount("");
    fetchGoals();
    toast.success("Progress updated");
    triggerHaptic("success");
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/goals/${id}`, { method: "DELETE" });
    fetchGoals();
    triggerHaptic("warning");
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Goals</h2>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <EmptyState
          icon={<Target className="w-10 h-10" />}
          title="No goals yet"
          description="Set financial goals and track your progress"
          action={<Button onClick={() => setShowAdd(true)} size="sm">Create Goal</Button>}
        />
      ) : (
        <div className="space-y-3">
          {goals.map((goal) => {
            const current = toDecimal(goal.currentAmount);
            const target = toDecimal(goal.targetAmount);
            const percent = target > 0 ? Math.min((current / target) * 100, 100) : 0;
            const remaining = target - current;
            const isCompleted = current >= target;

            let monthlyNeeded = 0;
            if (goal.deadline && !isCompleted) {
              const monthsLeft = Math.max(
                (new Date(goal.deadline).getTime() - renderNowTs) / (30 * 86400000),
                1
              );
              monthlyNeeded = remaining / monthsLeft;
            }
            const projection = projectionMap[goal.id];

            return (
              <motion.div
                key={goal.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <ProgressRing
                        value={current}
                        max={target}
                        size={64}
                        strokeWidth={5}
                        color={goal.color || "#22c55e"}
                        label={`${Math.round(percent)}%`}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold truncate">{goal.name}</p>
                          {isCompleted ? (
                            <Badge variant="success">
                              <Trophy className="w-3 h-3 mr-1" /> Done
                            </Badge>
                          ) : (
                            <button
                              onClick={() => { setShowUpdate(goal); setUpdateAmount(""); }}
                              className="text-xs text-primary font-medium"
                            >
                              + Update
                            </button>
                          )}
                        </div>
                        {projection && (
                          <div className="mt-1 flex items-center gap-2 text-xs">
                            <Badge
                              variant={
                                projection.status === "on_track"
                                  ? "success"
                                  : projection.status === "at_risk"
                                    ? "warning"
                                    : "destructive"
                              }
                            >
                              {Math.round(projection.probability)}% {projection.status.replace("_", " ")}
                            </Badge>
                            <span className="text-muted-foreground">
                              Projected {formatCurrency(projection.projectedAtDeadline, "INR", true)}
                            </span>
                          </div>
                        )}
                        <div className="mt-1">
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>{formatCurrency(current, "INR", true)}</span>
                            <span>{formatCurrency(target, "INR", true)}</span>
                          </div>
                          <Progress value={current} max={target} size="sm" indicatorClassName={`bg-[${goal.color}]`} />
                        </div>
                        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {goal.deadline && (
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {new Date(goal.deadline).toLocaleDateString("en-IN", {
                                month: "short",
                                year: "numeric",
                                timeZone: "Asia/Kolkata",
                              })}
                            </span>
                          )}
                          {monthlyNeeded > 0 && (
                            <span>Need {formatCurrency(monthlyNeeded, "INR", true)}/mo</span>
                          )}
                          {projection && projection.monthlyRequired > 0 && (
                            <span>Required {formatCurrency(projection.monthlyRequired, "INR", true)}/mo</span>
                          )}
                          <button
                            onClick={() => handleDelete(goal.id)}
                            className="ml-auto text-destructive/50 hover:text-destructive"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="New Goal">
        <div className="space-y-4">
          <Input label="Goal Name" placeholder="e.g., Emergency Fund" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
          <Input label="Target Amount" type="number" value={form.targetAmount} onChange={(e) => setForm((p) => ({ ...p, targetAmount: e.target.value }))} inputMode="decimal" />
          <Input label="Current Savings" type="number" value={form.currentAmount} onChange={(e) => setForm((p) => ({ ...p, currentAmount: e.target.value }))} inputMode="decimal" />
          <Input label="Deadline" type="date" value={form.deadline} onChange={(e) => setForm((p) => ({ ...p, deadline: e.target.value }))} />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Color</label>
            <div className="flex gap-2">
              {GOAL_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((p) => ({ ...p, color: c }))}
                  className={`w-8 h-8 rounded-full transition-all ${form.color === c ? "ring-2 ring-offset-2 ring-primary" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <Button onClick={handleAdd} className="w-full" disabled={!form.name || !form.targetAmount}>
            Create Goal
          </Button>
        </div>
      </Modal>

      <Modal open={!!showUpdate} onClose={() => setShowUpdate(null)} title="Update Progress">
        <div className="space-y-4">
          {showUpdate && (
            <p className="text-sm text-muted-foreground">
              Current: {formatCurrency(toDecimal(showUpdate.currentAmount))} / {formatCurrency(toDecimal(showUpdate.targetAmount))}
            </p>
          )}
          <Input
            label="Amount to Add"
            type="number"
            value={updateAmount}
            onChange={(e) => setUpdateAmount(e.target.value)}
            placeholder="How much did you save?"
            inputMode="decimal"
          />
          <Button onClick={handleUpdate} className="w-full" disabled={!updateAmount}>
            Update
          </Button>
        </div>
      </Modal>
    </div>
  );
}
