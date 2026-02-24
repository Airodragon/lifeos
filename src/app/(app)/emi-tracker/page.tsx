"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useFormat } from "@/hooks/use-format";
import { toDecimal } from "@/lib/utils";

interface Liability {
  id: string;
  name: string;
  emiAmount: string | null;
  startDate: string;
  endDate: string | null;
  outstanding: string;
}

export default function EmiTrackerPage() {
  const { fc: formatCurrency } = useFormat();
  const [items, setItems] = useState<Liability[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/liabilities")
      .then((r) => r.json())
      .then((data) => {
        setItems(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const withDue = useMemo(() => {
    const now = new Date();
    const today = now.getDate();
    return items
      .filter((l) => toDecimal(l.emiAmount) > 0)
      .map((l) => {
        const dueDay = new Date(l.startDate).getDate();
        const daysUntil = dueDay >= today ? dueDay - today : 30 - today + dueDay;
        return { ...l, dueDay, daysUntil };
      })
      .sort((a, b) => a.daysUntil - b.daysUntil);
  }, [items]);

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4 pb-6">
      <h2 className="text-lg font-semibold">EMI Tracker</h2>
      {withDue.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Add liabilities with EMI amount to see a monthly due calendar.
          </CardContent>
        </Card>
      ) : (
        withDue.map((item) => (
          <Card key={item.id}>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4" />
                {item.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">EMI amount</span>
                <span className="font-semibold">{formatCurrency(toDecimal(item.emiAmount))}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Due day</span>
                <span>Day {item.dueDay}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Next due</span>
                <span className={item.daysUntil <= 3 ? "text-warning font-semibold" : ""}>
                  {item.daysUntil === 0 ? "Today" : `In ${item.daysUntil} day(s)`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Outstanding</span>
                <span>{formatCurrency(toDecimal(item.outstanding), "INR", true)}</span>
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
