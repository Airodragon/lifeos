import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const defaultModelName = process.env.GEMINI_MODEL || "gemini-2.0-flash";

const CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Transport",
  "Shopping",
  "Entertainment",
  "Bills & Utilities",
  "Health & Medical",
  "Education",
  "Travel",
  "Rent & Housing",
  "Insurance",
  "Subscriptions",
  "Personal Care",
  "Gifts & Donations",
  "ATM Withdrawal",
  "Transfer",
  "Investment",
  "Income",
  "Salary",
  "Other",
];

interface CategorizationResult {
  category: string;
  tags: string[];
  confidence: number;
}

function getModel(modelName?: string) {
  return genAI.getGenerativeModel({ model: modelName || defaultModelName });
}

function parseFirstJson<T>(text: string): T | null {
  const cleaned = text.replace(/```json\s*/gi, "").replace(/```\s*/g, "").trim();
  const firstArray = cleaned.indexOf("[");
  const firstObject = cleaned.indexOf("{");
  const start =
    firstArray >= 0 && firstObject >= 0
      ? Math.min(firstArray, firstObject)
      : Math.max(firstArray, firstObject);
  if (start < 0) return null;
  const lastArray = cleaned.lastIndexOf("]");
  const lastObject = cleaned.lastIndexOf("}");
  const end = Math.max(lastArray, lastObject);
  if (end <= start) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

function inferTransactionFromText(emailBody: string): {
  amount: number;
  description: string;
  merchant: string;
  date: string;
  type: "income" | "expense";
} | null {
  const compact = emailBody.replace(/\s+/g, " ").trim();
  if (!compact) return null;

  const amountMatch =
    compact.match(/(?:rs\.?|inr|₹)\s*([0-9][0-9,]*\.?[0-9]{0,2})/i) ||
    compact.match(/([0-9][0-9,]*\.?[0-9]{0,2})\s*(?:rs\.?|inr|₹)/i) ||
    compact.match(/\b([0-9][0-9,]*\.[0-9]{2})\b/);
  if (!amountMatch) return null;

  const amount = Number((amountMatch[1] || "").replace(/,/g, ""));
  if (!Number.isFinite(amount) || amount <= 0) return null;

  const dateMatch =
    compact.match(/\b(\d{4}-\d{2}-\d{2})\b/) ||
    compact.match(/\b(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})\b/);
  const parsedDate = dateMatch ? new Date(dateMatch[1]) : new Date();
  const yyyy = parsedDate.getFullYear();
  const mm = `${parsedDate.getMonth() + 1}`.padStart(2, "0");
  const dd = `${parsedDate.getDate()}`.padStart(2, "0");
  const date = `${yyyy}-${mm}-${dd}`;

  const lower = compact.toLowerCase();
  const type: "income" | "expense" =
    /\b(credited|received|deposit|refund)\b/.test(lower) &&
    !/\b(debited|spent|withdrawn|paid)\b/.test(lower)
      ? "income"
      : "expense";

  const merchantMatch =
    compact.match(/(?:merchant|to|at)\s*[:\-]?\s*([A-Za-z0-9&.\- ]{3,40})/i) ||
    compact.match(/(?:from)\s*[:\-]?\s*([A-Za-z0-9&.\- ]{3,40})/i);
  const merchant = merchantMatch?.[1]?.trim() || "Transaction";

  return {
    amount,
    description: compact.slice(0, 240),
    merchant,
    date,
    type,
  };
}

export async function categorizeTransaction(
  description: string,
  amount: number,
  merchant?: string
): Promise<CategorizationResult> {
  try {
    const model = getModel();

    const prompt = `You are a financial transaction categorizer. Categorize this transaction into exactly one of these categories: ${CATEGORIES.join(", ")}.

Transaction: "${description}"${merchant ? `, Merchant: "${merchant}"` : ""}, Amount: ₹${amount}

Respond ONLY with valid JSON, no markdown: {"category": "...", "tags": ["..."], "confidence": 0.0-1.0}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = parseFirstJson<CategorizationResult>(text);
    if (parsed?.category) {
      return {
        category: parsed.category,
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 8) : [],
        confidence: Number(parsed.confidence) || 0,
      };
    }
    return { category: "Other", tags: [], confidence: 0 };
  } catch {
    return { category: "Other", tags: [], confidence: 0 };
  }
}

export async function parseEmailTransaction(
  emailBody: string
): Promise<{
  amount: number;
  description: string;
  merchant: string;
  date: string;
  type: "income" | "expense";
} | null> {
  try {
    const model = getModel(process.env.GEMINI_EMAIL_MODEL || defaultModelName);

    const prompt = `Extract financial transaction details from this email. If the email contains a transaction alert, return ONLY valid JSON (no markdown):
{"amount": number, "description": "...", "merchant": "...", "date": "YYYY-MM-DD", "type": "income"|"expense"}.
If no financial transaction is present, return {"found": false}.

Email content:
${emailBody.substring(0, 8000)}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = parseFirstJson<{
      found?: boolean;
      amount?: number;
      description?: string;
      merchant?: string;
      date?: string;
      type?: "income" | "expense";
    }>(text);
    if (!parsed) return inferTransactionFromText(emailBody);
    if (parsed.found === false) return null;
    if (!parsed.amount || !parsed.date || !parsed.type) {
      return inferTransactionFromText(emailBody);
    }
    return {
      amount: Number(parsed.amount),
      description: String(parsed.description || "").slice(0, 280),
      merchant: String(parsed.merchant || "Transaction").slice(0, 120),
      date: String(parsed.date),
      type: parsed.type === "income" ? "income" : "expense",
    };
  } catch {
    return inferTransactionFromText(emailBody);
  }
}

export interface FinancialInsightResult {
  summary: string;
  suggestions: string[];
  alerts: string[];
  opportunities: string[];
}

export interface WeeklyCfoBriefResult {
  summary: string;
  wins: string[];
  risks: string[];
  nextActions: string[];
}

export interface RecommendationResult {
  summary: string;
  portfolioActions: string[];
  spendingActions: string[];
  riskAlerts: string[];
  next7Days: string[];
}

export async function generateFinancialInsights(input: {
  currency: string;
  monthIncome: number;
  monthExpense: number;
  savingsRate: number;
  topCategories: Array<{ name: string; amount: number }>;
  upcomingBills: Array<{ name: string; amount: number; dueInDays: number }>;
  investments: { totalValue: number; gainPercent: number };
}): Promise<FinancialInsightResult> {
  try {
    const model = getModel();
    const prompt = `You are a personal finance coach. Analyze this monthly financial snapshot and return practical, concrete advice.

Snapshot:
- Currency: ${input.currency}
- Income: ${input.monthIncome}
- Expense: ${input.monthExpense}
- Savings rate: ${input.savingsRate}%
- Top spending categories: ${JSON.stringify(input.topCategories)}
- Upcoming bills: ${JSON.stringify(input.upcomingBills)}
- Investments: ${JSON.stringify(input.investments)}

Return ONLY valid JSON, no markdown:
{
  "summary": "2-3 sentence plain-language summary",
  "suggestions": ["3-5 actionable suggestions"],
  "alerts": ["0-3 risk alerts"],
  "opportunities": ["2-4 optimization opportunities"]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = parseFirstJson<FinancialInsightResult>(text);
    if (parsed?.summary) return parsed;
    throw new Error("Invalid insight response");
  } catch {
    return {
      summary: "Your financial snapshot is available. Keep tracking spending and savings consistently.",
      suggestions: [
        "Set a target savings percentage for this month.",
        "Review your top 3 spending categories weekly.",
        "Plan bill payments in advance to avoid surprises.",
      ],
      alerts: [],
      opportunities: [
        "Shift irregular expenses into planned monthly budgets.",
        "Automate part of your monthly investing.",
      ],
    };
  }
}

export async function generateWeeklyCfoBrief(input: {
  currency: string;
  weeklyIncome: number;
  weeklyExpense: number;
  weeklySavings: number;
  largestExpenses: Array<{ description: string; amount: number }>;
  upcomingPayments: Array<{ name: string; amount: number; dueInDays: number }>;
  portfolioChangePercent: number;
}): Promise<WeeklyCfoBriefResult> {
  try {
    const model = getModel();
    const prompt = `You are a personal CFO assistant. Analyze this weekly snapshot and provide concise insights.

Snapshot:
- Currency: ${input.currency}
- Weekly income: ${input.weeklyIncome}
- Weekly expense: ${input.weeklyExpense}
- Weekly savings: ${input.weeklySavings}
- Largest expenses: ${JSON.stringify(input.largestExpenses)}
- Upcoming payments: ${JSON.stringify(input.upcomingPayments)}
- Portfolio weekly change (%): ${input.portfolioChangePercent}

Return ONLY valid JSON:
{
  "summary": "2-3 sentence weekly summary",
  "wins": ["2-4 positive highlights"],
  "risks": ["0-3 risks to watch"],
  "nextActions": ["3-5 concrete actions for next 7 days"]
}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = parseFirstJson<WeeklyCfoBriefResult>(text);
    if (parsed?.summary) return parsed;
    throw new Error("Invalid weekly brief response");
  } catch {
    return {
      summary:
        "This week is stable overall. Keep expenses controlled and direct surplus toward your priority goals.",
      wins: ["You stayed on top of transaction tracking this week."],
      risks: ["Watch recurring discretionary spending categories."],
      nextActions: [
        "Set a fixed spend cap for the next 7 days.",
        "Pre-plan upcoming bill payments to avoid surprises.",
        "Auto-transfer part of surplus to investments/goals.",
      ],
    };
  }
}

export async function generateActionRecommendations(input: {
  currency: string;
  monthIncome: number;
  monthExpense: number;
  savingsRate: number;
  concentration: Array<{ symbol: string; weight: number; riskLevel: string }>;
  topSpends: Array<{ name: string; amount: number }>;
  watchlist: string[];
  priceAlerts: Array<{ symbol: string; targetPrice: number; direction: string; status: string }>;
}): Promise<RecommendationResult> {
  try {
    const model = getModel();
    const prompt = `You are a senior personal finance + investing advisor for an Indian retail investor.
Given this profile, return practical, low-jargon recommendations.

Profile:
- Currency: ${input.currency}
- Month income: ${input.monthIncome}
- Month expense: ${input.monthExpense}
- Savings rate: ${input.savingsRate}%
- Concentration risks: ${JSON.stringify(input.concentration)}
- Top spending buckets: ${JSON.stringify(input.topSpends)}
- Watchlist: ${JSON.stringify(input.watchlist)}
- Price alerts: ${JSON.stringify(input.priceAlerts)}

Return ONLY JSON:
{
  "summary": "2-3 sentence overview",
  "portfolioActions": ["3-5 portfolio actions"],
  "spendingActions": ["3-5 spending actions"],
  "riskAlerts": ["0-4 concise risk alerts"],
  "next7Days": ["3-6 concrete tasks for next 7 days"]
}`;
    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const parsed = parseFirstJson<RecommendationResult>(text);
    if (parsed?.summary) return parsed;
    throw new Error("Invalid recommendations response");
  } catch {
    return {
      summary: "Your profile is stable, with room to improve diversification and spending discipline.",
      portfolioActions: [
        "Cap any single holding to under 25% portfolio weight.",
        "Review watchlist names and keep alerts only for high-conviction entries.",
        "Add staggered SIP allocations to reduce timing risk.",
      ],
      spendingActions: [
        "Set weekly spend caps for your top two discretionary categories.",
        "Review recurring subscriptions and cancel low-usage services.",
        "Move a fixed amount to savings on salary day.",
      ],
      riskAlerts: [],
      next7Days: [
        "Rebalance one overweight position.",
        "Create or refine 3 key price alerts.",
        "Audit the last 30 days of high-value expenses.",
      ],
    };
  }
}
