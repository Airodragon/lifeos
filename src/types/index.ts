export type TransactionType = "income" | "expense" | "transfer";

export type AccountType = "bank" | "cash" | "credit_card" | "wallet";

export type InvestmentType = "stock" | "etf" | "crypto" | "mutual_fund";

export type OfflineAssetType =
  | "real_estate"
  | "gold"
  | "private_equity"
  | "vehicle"
  | "other";

export type LiabilityType =
  | "home_loan"
  | "car_loan"
  | "personal_loan"
  | "credit_card"
  | "education_loan"
  | "other";

export type GoalStatus = "active" | "completed" | "paused";

export type CommitteeStatus = "active" | "completed";

export type NotificationType =
  | "bill_reminder"
  | "investment_alert"
  | "committee_due"
  | "goal_milestone"
  | "budget_alert"
  | "general";

export type CategoryType = "income" | "expense";

export interface DashboardSummary {
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  investmentValue: number;
  investmentGain: number;
  investmentGainPercent: number;
  goalProgress: { name: string; current: number; target: number }[];
  recentTransactions: TransactionWithCategory[];
  upcomingPayments: UpcomingPayment[];
}

export interface TransactionWithCategory {
  id: string;
  amount: number;
  type: string;
  description: string | null;
  date: string;
  category: { name: string; icon: string | null; color: string | null } | null;
  account: { name: string } | null;
}

export interface UpcomingPayment {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  type: "committee" | "emi" | "bill";
}

export interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalGain: number;
  gainPercent: number;
  holdings: HoldingSummary[];
  allocation: { name: string; value: number; color: string }[];
}

export interface HoldingSummary {
  id: string;
  symbol: string;
  name: string;
  type: string;
  quantity: number;
  avgBuyPrice: number;
  currentPrice: number;
  value: number;
  gain: number;
  gainPercent: number;
}

export interface NetWorthBreakdown {
  netWorth: number;
  assets: {
    bankAccounts: number;
    investments: number;
    offlineAssets: number;
    cash: number;
    total: number;
  };
  liabilities: {
    loans: number;
    creditCards: number;
    total: number;
  };
  history: { date: string; value: number }[];
}

export interface BudgetOverview {
  month: number;
  year: number;
  categories: {
    id: string;
    name: string;
    icon: string | null;
    color: string | null;
    budgeted: number;
    spent: number;
    remaining: number;
    percentUsed: number;
  }[];
  totalBudgeted: number;
  totalSpent: number;
}

export const CATEGORY_ICONS: Record<string, string> = {
  "Food & Dining": "UtensilsCrossed",
  Groceries: "ShoppingCart",
  Transport: "Car",
  Shopping: "ShoppingBag",
  Entertainment: "Tv",
  "Bills & Utilities": "Zap",
  "Health & Medical": "Heart",
  Education: "GraduationCap",
  Travel: "Plane",
  "Rent & Housing": "Home",
  Insurance: "Shield",
  Subscriptions: "CreditCard",
  "Personal Care": "Sparkles",
  "Gifts & Donations": "Gift",
  "ATM Withdrawal": "Banknote",
  Transfer: "ArrowLeftRight",
  Investment: "TrendingUp",
  Income: "Wallet",
  Salary: "Briefcase",
  Other: "MoreHorizontal",
};

export const CATEGORY_COLORS: Record<string, string> = {
  "Food & Dining": "#f97316",
  Groceries: "#84cc16",
  Transport: "#3b82f6",
  Shopping: "#ec4899",
  Entertainment: "#8b5cf6",
  "Bills & Utilities": "#eab308",
  "Health & Medical": "#ef4444",
  Education: "#06b6d4",
  Travel: "#14b8a6",
  "Rent & Housing": "#6366f1",
  Insurance: "#64748b",
  Subscriptions: "#a855f7",
  "Personal Care": "#f472b6",
  "Gifts & Donations": "#fb923c",
  "ATM Withdrawal": "#22c55e",
  Transfer: "#94a3b8",
  Investment: "#10b981",
  Income: "#22c55e",
  Salary: "#0ea5e9",
  Other: "#6b7280",
};
