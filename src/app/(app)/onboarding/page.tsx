"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  Target,
  ArrowRight,
  Check,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const steps = [
  {
    id: "welcome",
    title: "Welcome to LifeOS",
    description: "Your personal finance command center. Let's set things up.",
    icon: Wallet,
  },
  {
    id: "accounts",
    title: "Add Your Accounts",
    description: "Track your bank accounts, wallets, and credit cards.",
    icon: Wallet,
  },
  {
    id: "investments",
    title: "Track Investments",
    description: "Add your stock, ETF, or crypto holdings.",
    icon: TrendingUp,
  },
  {
    id: "goals",
    title: "Set Your First Goal",
    description: "What are you saving for?",
    icon: Target,
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [accountForm, setAccountForm] = useState({ name: "", type: "bank", balance: "" });
  const [goalForm, setGoalForm] = useState({ name: "", targetAmount: "" });

  const currentStep = steps[step];

  const handleAddAccount = async () => {
    if (!accountForm.name) return;
    await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: accountForm.name,
        type: accountForm.type,
        balance: parseFloat(accountForm.balance || "0"),
      }),
    });
    toast.success("Account added");
    setAccountForm({ name: "", type: "bank", balance: "" });
  };

  const handleAddGoal = async () => {
    if (!goalForm.name || !goalForm.targetAmount) return;
    await fetch("/api/goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: goalForm.name,
        targetAmount: parseFloat(goalForm.targetAmount),
      }),
    });
    toast.success("Goal created");
  };

  const handleFinish = () => {
    router.push("/dashboard");
  };

  const next = () => {
    if (step < steps.length - 1) setStep(step + 1);
    else handleFinish();
  };

  const skip = () => {
    handleFinish();
  };

  return (
    <div className="min-h-[80vh] flex flex-col p-4">
      <div className="flex justify-between items-center mb-8">
        <div className="flex gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all ${
                i <= step ? "w-8 bg-primary" : "w-4 bg-muted"
              }`}
            />
          ))}
        </div>
        <button onClick={skip} className="text-sm text-muted-foreground">
          Skip
        </button>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="flex-1"
        >
          <div className="mb-8">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <currentStep.icon className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">{currentStep.title}</h2>
            <p className="text-muted-foreground mt-1">{currentStep.description}</p>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <Input
                label="Account Name"
                placeholder="e.g., HDFC Savings"
                value={accountForm.name}
                onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))}
              />
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Type</label>
                <select
                  value={accountForm.type}
                  onChange={(e) => setAccountForm((p) => ({ ...p, type: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-input bg-background px-4 text-sm"
                >
                  <option value="bank">Bank Account</option>
                  <option value="cash">Cash</option>
                  <option value="credit_card">Credit Card</option>
                  <option value="wallet">Wallet</option>
                </select>
              </div>
              <Input
                label="Current Balance"
                type="number"
                value={accountForm.balance}
                onChange={(e) => setAccountForm((p) => ({ ...p, balance: e.target.value }))}
                inputMode="decimal"
              />
              <Button onClick={handleAddAccount} variant="secondary" className="w-full" disabled={!accountForm.name}>
                <Plus className="w-4 h-4 mr-1" /> Add Account
              </Button>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <Input
                label="Goal Name"
                placeholder="e.g., Emergency Fund"
                value={goalForm.name}
                onChange={(e) => setGoalForm((p) => ({ ...p, name: e.target.value }))}
              />
              <Input
                label="Target Amount"
                type="number"
                placeholder="e.g., 500000"
                value={goalForm.targetAmount}
                onChange={(e) => setGoalForm((p) => ({ ...p, targetAmount: e.target.value }))}
                inputMode="decimal"
              />
              <Button onClick={handleAddGoal} variant="secondary" className="w-full" disabled={!goalForm.name}>
                <Plus className="w-4 h-4 mr-1" /> Create Goal
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-auto pt-6">
        <Button onClick={next} className="w-full h-12">
          {step === steps.length - 1 ? (
            <>
              <Check className="w-4 h-4 mr-2" /> Get Started
            </>
          ) : (
            <>
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
