"use client";

import { useSession, signIn, signOut } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useCallback } from "react";

export function useAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const login = useCallback(
    async (email: string, password: string) => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        throw new Error("Invalid email or password");
      }

      router.push("/dashboard");
      router.refresh();
    },
    [router]
  );

  const logout = useCallback(async () => {
    await signOut({ redirectTo: "/login" });
  }, []);

  return {
    user: session?.user,
    isAuthenticated: status === "authenticated",
    isLoading: status === "loading",
    login,
    logout,
  };
}
