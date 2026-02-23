"use client";

import { useSession } from "next-auth/react";
import { useTheme } from "next-themes";
import Link from "next/link";
import {
  User,
  Shield,
  Mail,
  Palette,
  Tag,
  Download,
  LogOut,
  ChevronRight,
  Moon,
  Sun,
  Smartphone,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useBiometric } from "@/hooks/use-biometric";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const settingsItems = [
  { href: "/settings/profile", icon: User, label: "Profile", description: "Name, email, currency" },
  { href: "/settings/security", icon: Shield, label: "Security", description: "Password, biometrics" },
  { href: "/settings/email", icon: Mail, label: "Email Sync", description: "Connect Gmail for auto-tracking" },
  { href: "#categories", icon: Tag, label: "Categories", description: "Manage expense categories" },
];

export default function SettingsPage() {
  const { data: session } = useSession();
  const { logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const { isSupported, register } = useBiometric();

  const handleBiometricSetup = async () => {
    try {
      const result = await register();
      if (result) toast.success("Face ID enabled");
      else toast.error("Setup failed");
    } catch {
      toast.error("Biometric setup failed");
    }
  };

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Settings</h2>

      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
            {session?.user?.name?.[0]?.toUpperCase() || "U"}
          </div>
          <div>
            <p className="font-medium">{session?.user?.name || "User"}</p>
            <p className="text-xs text-muted-foreground">{session?.user?.email}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0 divide-y divide-border/50">
          {settingsItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground">{item.description}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Palette className="w-5 h-5 text-muted-foreground" />
              <span className="text-sm font-medium">Theme</span>
            </div>
            <div className="flex gap-1 bg-muted rounded-lg p-0.5">
              <button
                onClick={() => setTheme("light")}
                className={`p-1.5 rounded-md ${theme === "light" ? "bg-card shadow-sm" : ""}`}
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`p-1.5 rounded-md ${theme === "dark" ? "bg-card shadow-sm" : ""}`}
              >
                <Moon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`px-2 py-1 rounded-md text-xs ${theme === "system" ? "bg-card shadow-sm" : ""}`}
              >
                Auto
              </button>
            </div>
          </div>

          {isSupported && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Smartphone className="w-5 h-5 text-muted-foreground" />
                <span className="text-sm font-medium">Face ID / Biometrics</span>
              </div>
              <Button variant="outline" size="sm" onClick={handleBiometricSetup}>
                Enable
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Button
        variant="ghost"
        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
        onClick={logout}
      >
        <LogOut className="w-4 h-4 mr-2" /> Sign Out
      </Button>
    </div>
  );
}
