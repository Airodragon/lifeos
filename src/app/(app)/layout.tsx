import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Header } from "@/components/layout/header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { PWAStatusBanner } from "@/components/layout/pwa-status-banner";
import { PushBootstrap } from "@/components/features/push-bootstrap";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <div
      className="min-h-svh bg-background max-w-2xl mx-auto relative"
      style={{
        paddingLeft: "env(safe-area-inset-left)",
        paddingRight: "env(safe-area-inset-right)",
      }}
    >
      <Header />
      <PWAStatusBanner />
      <PushBootstrap />
      <main className="pb-[calc(6rem+env(safe-area-inset-bottom))]">{children}</main>
      <BottomNav />
    </div>
  );
}
