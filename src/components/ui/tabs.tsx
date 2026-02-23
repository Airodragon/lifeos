"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Tab {
  id: string;
  label: string;
}

interface TabsProps {
  tabs: Tab[];
  activeTab?: string;
  onChange?: (id: string) => void;
  className?: string;
}

export function Tabs({ tabs, activeTab, onChange, className }: TabsProps) {
  const [active, setActive] = useState(activeTab || tabs[0]?.id);
  const current = activeTab ?? active;

  return (
    <div
      className={cn(
        "flex gap-1 rounded-xl bg-muted p-1",
        className
      )}
    >
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => {
            setActive(tab.id);
            onChange?.(tab.id);
          }}
          className={cn(
            "relative flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            current === tab.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {current === tab.id && (
            <motion.div
              layoutId="activeTab"
              className="absolute inset-0 rounded-lg bg-card shadow-sm"
              transition={{ type: "spring", bounce: 0.15, duration: 0.4 }}
            />
          )}
          <span className="relative z-10">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
