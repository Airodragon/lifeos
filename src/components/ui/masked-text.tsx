"use client";

import { usePrivacy } from "@/contexts/privacy-context";

interface MaskedProps {
  children: string;
  className?: string;
}

export function Masked({ children, className }: MaskedProps) {
  const { mask } = usePrivacy();
  return <span className={className}>{mask(children)}</span>;
}

export function useMask() {
  const { mask, privacyMode } = usePrivacy();
  return { mask, privacyMode };
}
