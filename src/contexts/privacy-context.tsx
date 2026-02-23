"use client";

import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from "react";

interface PrivacyContextType {
  privacyMode: boolean;
  togglePrivacy: () => void;
  mask: (value: string) => string;
}

const PrivacyContext = createContext<PrivacyContextType>({
  privacyMode: false,
  togglePrivacy: () => {},
  mask: (v) => v,
});

const STORAGE_KEY = "lifeos_privacy_mode";

export function PrivacyProvider({ children }: { children: ReactNode }) {
  const [privacyMode, setPrivacyMode] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "true") setPrivacyMode(true);
  }, []);

  const togglePrivacy = useCallback(() => {
    setPrivacyMode((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  const mask = useCallback(
    (value: string) => {
      if (!privacyMode) return value;
      return value.replace(/[\d,.]+/g, "••••");
    },
    [privacyMode]
  );

  return (
    <PrivacyContext.Provider value={{ privacyMode, togglePrivacy, mask }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function usePrivacy() {
  return useContext(PrivacyContext);
}
