"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import { PrivacyProvider } from "@/contexts/privacy-context";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        <PrivacyProvider>
          {children}
          <Toaster
            position="top-center"
            toastOptions={{
              className:
                "bg-card text-card-foreground border border-border/50 shadow-lg",
            }}
          />
        </PrivacyProvider>
      </ThemeProvider>
    </SessionProvider>
  );
}
