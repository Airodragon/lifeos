"use client";

import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Mail,
  ExternalLink,
  Loader2,
  CheckCircle2,
  Trash2,
  RefreshCcw,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface EmailConnection {
  id: string;
  email: string;
  provider: string;
  lastSyncAt: string | null;
}

export default function EmailSettingsPage() {
  const [authUrl, setAuthUrl] = useState("");
  const [redirectUri, setRedirectUri] = useState("");
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [connection, setConnection] = useState<EmailConnection | null>(null);

  const refreshStatus = async () => {
    const [auth, status] = await Promise.all([
      fetch("/api/email-sync").then((r) => r.json()),
      fetch("/api/email-sync/status").then((r) => r.json()),
    ]);
    setAuthUrl(auth.authUrl || "");
    setRedirectUri(auth.redirectUri || "");
    setConnection(status.connected ? status.connection : null);
  };

  useEffect(() => {
    refreshStatus()
      .then(() => {
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast.success("Gmail connected successfully!");
      window.history.replaceState({}, "", "/settings/email");
    } else if (params.get("error")) {
      toast.error("Failed to connect Gmail");
      window.history.replaceState({}, "", "/settings/email");
    }
  }, []);

  const handleDisconnect = async () => {
    await fetch("/api/email-sync/status", { method: "DELETE" });
    setConnection(null);
    toast.success("Gmail disconnected");
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      const res = await fetch("/api/email-sync/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || "Sync failed");
        return;
      }
      toast.success(`Synced ${data.synced ?? 0} new transaction(s)`);
      await refreshStatus();
    } catch {
      toast.error("Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="p-1.5 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-lg font-semibold">Email Sync</h2>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          {connection ? (
            <>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">Gmail Connected</p>
                    <Badge variant="success">Active</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{connection.email}</p>
                  {connection.lastSyncAt && (
                    <p className="text-[10px] text-muted-foreground">
                      Last synced: {formatDate(connection.lastSyncAt)}
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleSyncNow}
                disabled={syncing}
              >
                {syncing ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <RefreshCcw className="w-4 h-4 mr-2" />
                )}
                Sync Now
              </Button>
              <Button
                variant="outline"
                className="w-full text-destructive border-destructive/30"
                onClick={handleDisconnect}
              >
                <Trash2 className="w-4 h-4 mr-2" /> Disconnect Gmail
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium">Connect Gmail</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Auto-sync transactional emails from your bank, UPI, and shopping accounts.
                  </p>
                </div>
              </div>

              {loading ? (
                <Button disabled className="w-full">
                  <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading...
                </Button>
              ) : authUrl ? (
                <a href={authUrl}>
                  <Button className="w-full">
                    <ExternalLink className="w-4 h-4 mr-2" /> Connect Gmail
                  </Button>
                </a>
              ) : (
                <p className="text-xs text-muted-foreground text-center">
                  Gmail OAuth not configured.
                </p>
              )}
            </>
          )}

          <div className="pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              We only read transactional emails from known banks and merchants. Your data is encrypted and private.
            </p>
            {redirectUri && (
              <p className="text-[10px] text-muted-foreground mt-2 break-all">
                Google redirect URI: {redirectUri}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
