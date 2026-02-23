"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

export default function ProfileSettingsPage() {
  const { data: session } = useSession();
  const [name, setName] = useState(session?.user?.name || "");

  const handleSave = () => {
    toast.success("Profile updated");
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/settings" className="p-1.5 rounded-lg hover:bg-muted">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <h2 className="text-lg font-semibold">Profile</h2>
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" value={session?.user?.email || ""} disabled />
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Currency</label>
            <select className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm">
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
            </select>
          </div>
          <Button onClick={handleSave} className="w-full">Save Changes</Button>
        </CardContent>
      </Card>
    </div>
  );
}
