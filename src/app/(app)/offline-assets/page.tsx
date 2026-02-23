"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Building2, Gem, Briefcase, Plus, Car, Package } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { formatDate, toDecimal } from "@/lib/utils";
import { useFormat } from "@/hooks/use-format";
import { toast } from "sonner";

interface OfflineAsset {
  id: string;
  name: string;
  type: string;
  purchasePrice: string;
  currentValue: string;
  appreciationRate: string | null;
  purchaseDate: string | null;
  notes: string | null;
}

const TYPE_ICONS: Record<string, typeof Building2> = {
  real_estate: Building2,
  gold: Gem,
  private_equity: Briefcase,
  vehicle: Car,
  other: Package,
};

const TYPE_LABELS: Record<string, string> = {
  real_estate: "Real Estate",
  gold: "Gold",
  private_equity: "Private Equity",
  vehicle: "Vehicle",
  other: "Other",
};

export default function OfflineAssetsPage() {
  const { fc: formatCurrency, fp: formatPercent } = useFormat();
  const [assets, setAssets] = useState<OfflineAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    name: "",
    type: "real_estate",
    purchasePrice: "",
    currentValue: "",
    appreciationRate: "",
    purchaseDate: "",
    notes: "",
  });

  const fetchAssets = async () => {
    const res = await fetch("/api/offline-assets");
    const data = await res.json();
    setAssets(data || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchAssets();
  }, []);

  const handleAdd = async () => {
    if (!form.name || !form.purchasePrice) return;
    await fetch("/api/offline-assets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        purchasePrice: parseFloat(form.purchasePrice),
        currentValue: parseFloat(form.currentValue || form.purchasePrice),
        appreciationRate: form.appreciationRate ? parseFloat(form.appreciationRate) : null,
        purchaseDate: form.purchaseDate || null,
      }),
    });
    setShowAdd(false);
    setForm({ name: "", type: "real_estate", purchasePrice: "", currentValue: "", appreciationRate: "", purchaseDate: "", notes: "" });
    fetchAssets();
    toast.success("Asset added");
  };

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  const totalValue = assets.reduce((s, a) => s + toDecimal(a.currentValue), 0);
  const totalCost = assets.reduce((s, a) => s + toDecimal(a.purchasePrice), 0);

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Offline Assets</h2>
          <p className="text-xs text-muted-foreground">
            Total: {formatCurrency(totalValue)}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)}>
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {assets.length === 0 ? (
        <EmptyState
          icon={<Building2 className="w-10 h-10" />}
          title="No offline assets"
          description="Track your real estate, gold, and other physical assets"
          action={
            <Button onClick={() => setShowAdd(true)} size="sm">
              Add Asset
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {assets.map((asset) => {
            const Icon = TYPE_ICONS[asset.type] || Package;
            const cost = toDecimal(asset.purchasePrice);
            const current = toDecimal(asset.currentValue);
            const gain = current - cost;
            const gainPercent = cost > 0 ? (gain / cost) * 100 : 0;

            return (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                          <Icon className="w-5 h-5 text-amber-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{asset.name}</p>
                          <Badge variant="secondary">{TYPE_LABELS[asset.type]}</Badge>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold">{formatCurrency(current)}</p>
                        <p
                          className={`text-xs ${gain >= 0 ? "text-success" : "text-destructive"}`}
                        >
                          {formatPercent(gainPercent)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 pt-2 border-t border-border/30 flex justify-between text-xs text-muted-foreground">
                      <span>Purchase: {formatCurrency(cost)}</span>
                      {asset.appreciationRate && (
                        <span>{toDecimal(asset.appreciationRate)}% p.a.</span>
                      )}
                      {asset.purchaseDate && <span>{formatDate(asset.purchaseDate)}</span>}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Add Offline Asset">
        <div className="space-y-4">
          <Input
            label="Asset Name"
            placeholder="e.g., Apartment in Mumbai"
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}
              className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
            >
              {Object.entries(TYPE_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <Input
            label="Purchase Price"
            type="number"
            value={form.purchasePrice}
            onChange={(e) => setForm((p) => ({ ...p, purchasePrice: e.target.value }))}
            inputMode="decimal"
          />
          <Input
            label="Current Value"
            type="number"
            placeholder="Leave empty to use purchase price"
            value={form.currentValue}
            onChange={(e) => setForm((p) => ({ ...p, currentValue: e.target.value }))}
            inputMode="decimal"
          />
          <Input
            label="Appreciation Rate (% per year)"
            type="number"
            placeholder="e.g., 8"
            value={form.appreciationRate}
            onChange={(e) => setForm((p) => ({ ...p, appreciationRate: e.target.value }))}
            inputMode="decimal"
          />
          <Input
            label="Purchase Date"
            type="date"
            value={form.purchaseDate}
            onChange={(e) => setForm((p) => ({ ...p, purchaseDate: e.target.value }))}
          />
          <Button onClick={handleAdd} className="w-full" disabled={!form.name || !form.purchasePrice}>
            Add Asset
          </Button>
        </div>
      </Modal>
    </div>
  );
}
