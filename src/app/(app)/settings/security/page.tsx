"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Shield, KeyRound, Key, Trash2, Loader2, Plus, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useBiometric } from "@/hooks/use-biometric";
import { toast } from "sonner";

interface PasskeyInfo {
  id: string;
  createdAt: string;
}

export default function SecuritySettingsPage() {
  const { isSupported, register } = useBiometric();
  const [passkeys, setPasskeys] = useState<PasskeyInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    fetch("/api/webauthn/passkeys")
      .then((r) => r.json())
      .then((data) => {
        setPasskeys(data.passkeys || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleRegisterPasskey = async () => {
    setRegistering(true);
    try {
      const result = await register();
      if (result) {
        toast.success("Passkey registered successfully!");
        const res = await fetch("/api/webauthn/passkeys");
        const data = await res.json();
        setPasskeys(data.passkeys || []);
      } else {
        toast.error("Passkey registration failed");
      }
    } catch {
      toast.error("Failed to register passkey");
    }
    setRegistering(false);
  };

  const handleDeletePasskey = async (id: string) => {
    const res = await fetch("/api/webauthn/passkeys", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      setPasskeys((prev) => prev.filter((p) => p.id !== id));
      toast.success("Passkey removed");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="p-1.5 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-lg font-semibold">Security</h2>
      </div>

      {/* Passkeys Section */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <KeyRound className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium">Passkeys</p>
                <p className="text-[10px] text-muted-foreground">
                  Sign in with Face ID, Touch ID, or device PIN
                </p>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {passkeys.length > 0 ? (
                <div className="space-y-2">
                  {passkeys.map((pk, idx) => (
                    <div
                      key={pk.id}
                      className="flex items-center justify-between rounded-xl bg-muted/50 px-3 py-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-success" />
                        <div>
                          <p className="text-xs font-medium">Passkey {idx + 1}</p>
                          <p className="text-[10px] text-muted-foreground">
                            Added{" "}
                            {new Date(pk.createdAt).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              timeZone: "Asia/Kolkata",
                            })}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDeletePasskey(pk.id)}
                        className="p-1.5 rounded-lg text-destructive/50 hover:text-destructive hover:bg-destructive/5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-3">
                  <p className="text-xs text-muted-foreground">No passkeys registered</p>
                </div>
              )}

              {isSupported && (
                <Button
                  variant={passkeys.length > 0 ? "outline" : "default"}
                  className="w-full"
                  onClick={handleRegisterPasskey}
                  disabled={registering}
                >
                  {registering ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Plus className="w-4 h-4 mr-2" />
                  )}
                  {passkeys.length > 0 ? "Add Another Passkey" : "Register Passkey"}
                </Button>
              )}

              {!isSupported && (
                <p className="text-xs text-muted-foreground text-center">
                  Passkeys are not supported on this browser.
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Password Section */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Password</p>
              <p className="text-xs text-muted-foreground">Change your account password</p>
            </div>
            <Button variant="outline" size="sm">Change</Button>
          </div>
        </CardContent>
      </Card>

      {/* Info */}
      <div className="px-1">
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Passkeys use your device&apos;s biometric authentication (Face ID, Touch ID, or device PIN) to securely sign you in without a password. They&apos;re phishing-resistant and stored securely on your device.
        </p>
      </div>
    </div>
  );
}
