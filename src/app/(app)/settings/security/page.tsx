"use client";

import { ArrowLeft, Shield, Smartphone, Key } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useBiometric } from "@/hooks/use-biometric";
import { toast } from "sonner";

export default function SecuritySettingsPage() {
  const { isSupported, register } = useBiometric();

  const handleBiometric = async () => {
    try {
      const result = await register();
      if (result) toast.success("Biometric authentication enabled");
    } catch {
      toast.error("Failed to enable biometrics");
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

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-3">
            <Key className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">Change Password</p>
              <p className="text-xs text-muted-foreground">Update your password</p>
            </div>
            <Button variant="outline" size="sm">Change</Button>
          </div>

          {isSupported && (
            <div className="flex items-center gap-3">
              <Smartphone className="w-5 h-5 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium">Face ID / Touch ID</p>
                <p className="text-xs text-muted-foreground">Use biometrics to unlock the app</p>
              </div>
              <Button variant="outline" size="sm" onClick={handleBiometric}>Enable</Button>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Shield className="w-5 h-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-medium">App Lock</p>
              <p className="text-xs text-muted-foreground">Require authentication on app open</p>
            </div>
            <Button variant="outline" size="sm">Setup</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
