"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Loader2, Eye, EyeOff, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { startAuthentication } from "@simplewebauthn/browser";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";

const schema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type FormData = z.infer<typeof schema>;

export default function LoginPage() {
  const { login } = useAuth();
  const router = useRouter();
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyAvailable, setPasskeyAvailable] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && window.PublicKeyCredential) {
      PublicKeyCredential.isConditionalMediationAvailable?.().then((available) => {
        setPasskeyAvailable(available || !!window.PublicKeyCredential);
      }).catch(() => {
        setPasskeyAvailable(!!window.PublicKeyCredential);
      });
    }
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    setError("");
    setLoading(true);
    try {
      await login(data.email, data.password);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handlePasskeyLogin = async () => {
    setError("");
    setPasskeyLoading(true);
    try {
      const optionsRes = await fetch("/api/webauthn/authenticate/begin");
      if (!optionsRes.ok) throw new Error("Failed to start passkey auth");
      const options = await optionsRes.json();

      const assertion = await startAuthentication(options);

      const verifyRes = await fetch("/api/webauthn/authenticate/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      });

      const result = await verifyRes.json();
      if (!result.verified || !result.email) {
        throw new Error("Passkey verification failed");
      }

      const signInResult = await signIn("credentials", {
        email: result.email,
        password: "__passkey__",
        passkey: "true",
        redirect: false,
      });

      if (signInResult?.error) {
        throw new Error("Sign-in failed");
      }

      router.push("/dashboard");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Passkey login failed");
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">LifeOS</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Your personal finance dashboard.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          autoComplete="email webauthn"
          error={errors.email?.message}
          {...register("email")}
        />

        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            autoComplete="current-password"
            error={errors.password?.message}
            {...register("password")}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-[34px] text-muted-foreground"
          >
            {showPassword ? (
              <EyeOff className="w-4 h-4" />
            ) : (
              <Eye className="w-4 h-4" />
            )}
          </button>
        </div>

        {error && (
          <p className="text-sm text-destructive text-center">{error}</p>
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            "Sign In"
          )}
        </Button>
      </form>

      {passkeyAvailable && (
        <>
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-border/50" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 h-px bg-border/50" />
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={handlePasskeyLogin}
            disabled={passkeyLoading}
          >
            {passkeyLoading ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <KeyRound className="w-4 h-4 mr-2" />
            )}
            Sign in with Passkey
          </Button>
        </>
      )}
    </motion.div>
  );
}
