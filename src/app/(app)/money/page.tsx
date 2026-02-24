"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Landmark, CreditCard, ArrowDownRight, ArrowUpRight, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useFormat } from "@/hooks/use-format";
import { formatDateTime, toDecimal } from "@/lib/utils";
import Link from "next/link";

interface Account {
  id: string;
  name: string;
  type: string;
  balance: string;
}

interface Transaction {
  id: string;
  amount: string;
  type: "income" | "expense" | "transfer";
  description: string | null;
  date: string;
  category: { name: string } | null;
  account: { name: string } | null;
}

const TRACKING_START = "2026-03-01";

export default function MoneyPage() {
  const { fc: formatCurrency } = useFormat();
  const [activeTab, setActiveTab] = useState("all");
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchMoneyData = useCallback(async () => {
    setLoading(true);
    const typeQuery = activeTab !== "all" ? `&type=${activeTab}` : "";
    const [accRes, txRes] = await Promise.all([
      fetch("/api/accounts"),
      fetch(`/api/transactions?limit=100&startDate=${TRACKING_START}${typeQuery}`),
    ]);
    const accData = await accRes.json();
    const txData = await txRes.json();
    setAccounts(accData || []);
    setTransactions(txData.transactions || []);
    setLoading(false);
  }, [activeTab]);

  useEffect(() => {
    fetchMoneyData();
  }, [fetchMoneyData]);

  const totals = useMemo(() => {
    const bankBalance = accounts
      .filter((a) => a.type !== "credit_card")
      .reduce((sum, a) => sum + toDecimal(a.balance), 0);
    const creditDue = accounts
      .filter((a) => a.type === "credit_card")
      .reduce((sum, a) => sum + Math.abs(toDecimal(a.balance)), 0);
    const income = transactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + toDecimal(t.amount), 0);
    const expense = transactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + toDecimal(t.amount), 0);
    return { bankBalance, creditDue, income, expense };
  }, [accounts, transactions]);

  return (
    <div className="p-4 space-y-4 pb-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Expense / Income</h2>
          <p className="text-xs text-muted-foreground">
            Tracking from {new Date(TRACKING_START).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchMoneyData}>
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Bank/Wallet Balance</p>
            <p className="text-sm font-semibold">{formatCurrency(totals.bankBalance, "INR", true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Credit Card Due</p>
            <p className="text-sm font-semibold text-destructive">{formatCurrency(totals.creditDue, "INR", true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Income (Period)</p>
            <p className="text-sm font-semibold text-success">{formatCurrency(totals.income, "INR", true)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3">
            <p className="text-[10px] text-muted-foreground">Expense (Period)</p>
            <p className="text-sm font-semibold text-destructive">{formatCurrency(totals.expense, "INR", true)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-3 flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            Manage bank accounts and cards in one place.
          </div>
          <Link href="/accounts">
            <Button size="sm" variant="outline">
              <Landmark className="w-4 h-4 mr-1" />
              Accounts
            </Button>
          </Link>
        </CardContent>
      </Card>

      <Tabs
        tabs={[
          { id: "all", label: "All" },
          { id: "expense", label: "Expense" },
          { id: "income", label: "Income" },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {loading ? (
            <p className="text-xs text-muted-foreground">Loading...</p>
          ) : transactions.length === 0 ? (
            <p className="text-xs text-muted-foreground">No transactions yet in this range.</p>
          ) : (
            transactions.slice(0, 20).map((txn) => (
              <div key={txn.id} className="rounded-xl border border-border/40 p-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {txn.description || txn.category?.name || "Transaction"}
                  </p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {formatDateTime(txn.date)}
                    {txn.account?.name ? ` · ${txn.account.name}` : ""}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-xs font-semibold ${txn.type === "income" ? "text-success" : "text-destructive"}`}>
                    {txn.type === "income" ? <ArrowUpRight className="w-3 h-3 inline mr-1" /> : <ArrowDownRight className="w-3 h-3 inline mr-1" />}
                    {formatCurrency(toDecimal(txn.amount))}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Link href="/expenses">
          <Button variant="outline" className="w-full">Open Full Expenses</Button>
        </Link>
        <Link href="/monthly">
          <Button variant="outline" className="w-full">
            <CreditCard className="w-4 h-4 mr-1" />
            Monthly View
          </Button>
        </Link>
      </div>
    </div>
  );
}

