import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PWAStatusBanner } from "@/components/layout/pwa-status-banner";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div className="min-h-svh bg-background max-w-2xl mx-auto relative">
      <Header />
      <PWAStatusBanner />
      <main className="pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
