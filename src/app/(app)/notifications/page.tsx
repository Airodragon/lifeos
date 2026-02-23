"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, BellOff, Check, CheckCheck, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { getRelativeTime } from "@/lib/utils";

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

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) {
    return <div className="p-4 space-y-3">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted animate-pulse" />)}</div>;
  }

  return (
    <div className="p-4 space-y-4">
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
