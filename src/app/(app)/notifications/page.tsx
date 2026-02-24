"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, BellOff, Check, CheckCheck, ShieldCheck, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { getRelativeTime } from "@/lib/utils";
import { toast } from "sonner";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  createdAt: string;
}

const TYPE_COLORS: Record<string, string> = {
  bill_reminder: "#eab308",
  investment_alert: "#3b82f6",
  committee_due: "#f97316",
  goal_milestone: "#22c55e",
  budget_alert: "#ef4444",
  general: "#6b7280",
};

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAlerts, setRunningAlerts] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    concentrationThreshold: "25",
    budgetUsageThreshold: "90",
    drawdownThreshold: "8",
  });

  useEffect(() => {
    try {
      const saved = localStorage.getItem("lifeos-alert-config");
      if (saved) {
        const parsed = JSON.parse(saved) as typeof alertConfig;
        setAlertConfig(parsed);
      }
    } catch {
      // ignore malformed local data
    }
  }, []);

  const fetchNotifications = async () => {
    const res = await fetch("/api/notifications");
    const data = await res.json();
    setNotifications(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, []);

  const markRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, read: true }),
    });
    fetchNotifications();
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true }),
    });
    fetchNotifications();
  };

  const runAlertsEngine = async () => {
    setRunningAlerts(true);
    const payload = {
      config: {
        concentrationThreshold: Number(alertConfig.concentrationThreshold || 25),
        budgetUsageThreshold: Number(alertConfig.budgetUsageThreshold || 90),
        drawdownThreshold: Number(alertConfig.drawdownThreshold || 8),
      },
    };
    try {
      localStorage.setItem("lifeos-alert-config", JSON.stringify(alertConfig));
      const res = await fetch("/api/alerts/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Could not run alerts engine");
      } else {
        toast.success(`Generated ${data.generated || 0} new alerts`);
        await fetchNotifications();
      }
    } catch {
      toast.error("Could not run alerts engine");
    } finally {
      setRunningAlerts(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <Card id="alerts-engine">
        <CardContent className="p-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4" />
                Alerts Engine
              </p>
              <p className="text-xs text-muted-foreground">
                Configure thresholds and generate actionable alerts.
              </p>
            </div>
            <Button size="sm" onClick={runAlertsEngine} disabled={runningAlerts}>
              <Sparkles className="w-4 h-4 mr-1" />
              {runningAlerts ? "Running..." : "Run now"}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <Input
              label="Concentration %"
              type="number"
              value={alertConfig.concentrationThreshold}
              onChange={(e) =>
                setAlertConfig((p) => ({ ...p, concentrationThreshold: e.target.value }))
              }
            />
            <Input
              label="Budget Usage %"
              type="number"
              value={alertConfig.budgetUsageThreshold}
              onChange={(e) => setAlertConfig((p) => ({ ...p, budgetUsageThreshold: e.target.value }))}
            />
            <Input
              label="Drawdown %"
              type="number"
              value={alertConfig.drawdownThreshold}
              onChange={(e) => setAlertConfig((p) => ({ ...p, drawdownThreshold: e.target.value }))}
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Notifications</h2>
          {unreadCount > 0 && (
            <p className="text-xs text-muted-foreground">{unreadCount} unread</p>
          )}
        </div>
        {unreadCount > 0 && (
          <Button variant="ghost" size="sm" onClick={markAllRead}>
            <CheckCheck className="w-4 h-4 mr-1" /> Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={<BellOff className="w-10 h-10" />}
          title="No notifications"
          description="You're all caught up!"
        />
      ) : (
        <div className="space-y-2">
          {notifications.map((notif) => (
            <motion.div
              key={notif.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className={notif.read ? "opacity-60" : ""}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <div
                      className="w-2 h-2 rounded-full mt-2 shrink-0"
                      style={{ backgroundColor: notif.read ? "transparent" : TYPE_COLORS[notif.type] || "#6b7280" }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{notif.title}</p>
                        <span className="text-[10px] text-muted-foreground shrink-0 ml-2">
                          {getRelativeTime(notif.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{notif.message}</p>
                    </div>
                    {!notif.read && (
                      <button
                        onClick={() => markRead(notif.id)}
                        className="p-1 text-muted-foreground hover:text-foreground shrink-0"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
