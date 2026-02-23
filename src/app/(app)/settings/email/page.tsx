"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Mail, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function EmailSettingsPage() {
  const [authUrl, setAuthUrl] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/email-sync")
      .then((r) => r.json())
      .then((d) => {
        setAuthUrl(d.authUrl || "");
        setLoading(false);
      })
      .catch(() => setLoading(false));

    const params = new URLSearchParams(window.location.search);
    if (params.get("success") === "true") {
      toast.success("Gmail connected successfully!");
    } else if (params.get("error")) {
      toast.error("Failed to connect Gmail");
    }
  }, []);

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
          <div className="flex items-start gap-3">
            <Mail className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-medium">Connect Gmail</p>
              <p className="text-xs text-muted-foreground mt-1">
                Automatically sync transactional emails from your bank, UPI, and shopping accounts to track expenses.
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
              Gmail OAuth not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your environment.
            </p>
          )}

          <div className="pt-3 border-t border-border/50">
            <p className="text-xs text-muted-foreground">
              We only read transactional emails from known banks and merchants. Your data is encrypted and private.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
