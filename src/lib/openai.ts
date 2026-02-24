import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

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

export async function categorizeTransaction(
  description: string,
  amount: number,
  merchant?: string
): Promise<CategorizationResult> {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `You are a financial transaction categorizer. Categorize this transaction into exactly one of these categories: ${CATEGORIES.join(", ")}.

Transaction: "${description}"${merchant ? `, Merchant: "${merchant}"` : ""}, Amount: ₹${amount}

Respond ONLY with valid JSON, no markdown: {"category": "...", "tags": ["..."], "confidence": 0.0-1.0}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(jsonStr) as CategorizationResult;
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    const prompt = `Extract financial transaction details from this email. If the email contains a transaction, respond ONLY with valid JSON (no markdown): {"amount": number, "description": "...", "merchant": "...", "date": "YYYY-MM-DD", "type": "income"|"expense"}. If no transaction found, respond: {"found": false}

Email content:
${emailBody.substring(0, 2000)}`;

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();
    const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(jsonStr);
    if (parsed.found === false) return null;
    return parsed;
  } catch {
    return null;
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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
    const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(jsonStr) as FinancialInsightResult;
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
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
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
    const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(jsonStr) as WeeklyCfoBriefResult;
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
