"use client";

import { useState, useCallback } from "react";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

export function useBiometric() {
  const [isSupported] = useState(() => {
    if (typeof window === "undefined") return false;
    return !!window.PublicKeyCredential;
  });

  const register = useCallback(async () => {
    const optionsRes = await fetch("/api/webauthn/register");
    const options = await optionsRes.json();

    const attestation = await startRegistration(options);

    const verifyRes = await fetch("/api/webauthn/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(attestation),
    });

    const verification = await verifyRes.json();
    return verification.verified;
  }, []);

  const authenticate = useCallback(async () => {
    const optionsRes = await fetch("/api/webauthn/authenticate");
    const options = await optionsRes.json();

    const assertion = await startAuthentication(options);

    const verifyRes = await fetch("/api/webauthn/authenticate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(assertion),
    });

    const verification = await verifyRes.json();
    return verification.verified;
  }, []);

  return { isSupported, register, authenticate };
}
