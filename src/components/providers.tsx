"use client";

import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from "next-themes";
import { Toaster } from "sonner";
import type { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
        {children}
        <Toaster
          position="top-center"
          toastOptions={{
            className:
              "bg-card text-card-foreground border border-border/50 shadow-lg",
          }}
        />
      </ThemeProvider>
    </SessionProvider>
  );
}
