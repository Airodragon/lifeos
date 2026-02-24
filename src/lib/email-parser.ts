import { google } from "googleapis";
import { decrypt } from "./encryption";
import { parseEmailTransaction } from "./openai";

interface EmailCredentials {
  accessToken: string;
  refreshToken: string | null;
}

function getBaseUrl() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL)
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

export function getGoogleRedirectUri() {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  return `${getBaseUrl()}/api/email-sync/callback`;
}

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    getGoogleRedirectUri()
  );
}

export function getGmailAuthUrl(state: string): string {
  const oauth2Client = getOAuthClient();
  return oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
    state,
    prompt: "consent",
  });
}

export async function getTokensFromCode(code: string) {
  const oauth2Client = getOAuthClient();
  const { tokens } = await oauth2Client.getToken(code);
  return tokens;
}

export async function fetchTransactionEmails(
  credentials: EmailCredentials,
  since?: Date
) {
  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token: decrypt(credentials.accessToken),
    refresh_token: credentials.refreshToken
      ? decrypt(credentials.refreshToken)
      : undefined,
  });

  const gmail = google.gmail({ version: "v1", auth: oauth2Client });

  const afterDate = since
    ? Math.floor(since.getTime() / 1000)
    : Math.floor(Date.now() / 1000) - 7 * 86400;

  const senderPatterns = [
    "from:hdfcbank",
    "from:icicibank",
    "from:axisbank",
    "from:kotak",
    "from:sbi",
    "from:yesbank",
    "from:indusind",
    "from:paytm",
    "from:phonepe",
    "from:googlepay",
    "from:amazon",
    "from:flipkart",
    "from:cred",
    "from:airtel",
    "from:jio",
  ];
  const keywordPatterns = [
    "subject:(debited OR credited OR spent OR received OR transaction OR payment OR successful OR failed)",
    "subject:(UPI OR IMPS OR NEFT OR RTGS OR card OR wallet OR statement OR alert)",
  ];

  const query = `(${senderPatterns.join(" OR ")} OR ${keywordPatterns.join(" OR ")}) after:${afterDate}`;

  const messages: { id?: string | null }[] = [];
  let pageToken: string | undefined;
  for (let i = 0; i < 5; i++) {
    const response = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 50,
      pageToken,
    });
    messages.push(...(response.data.messages || []));
    pageToken = response.data.nextPageToken || undefined;
    if (!pageToken) break;
  }

  const transactions = [];

  for (const msg of messages) {
    const full = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "full",
    });

    const message = full.data as unknown as Record<string, unknown>;
    const payload = message.payload as Record<string, unknown> | undefined;
    const headers = (payload?.headers as Array<{ name?: string; value?: string }> | undefined) || [];
    const subject = headers.find((h) => h.name?.toLowerCase() === "subject")?.value || "";
    const from = headers.find((h) => h.name?.toLowerCase() === "from")?.value || "";
    const dateHeader = headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";
    const snippet = (message.snippet as string | undefined) || "";
    const body = extractBody(message) || "";
    const richContent = `Subject: ${subject}\nFrom: ${from}\nDate: ${dateHeader}\nSnippet: ${snippet}\nBody: ${body}`;
    if (!richContent.trim()) continue;

    const parsed = await parseEmailTransaction(richContent);
    if (parsed) {
      transactions.push({
        ...parsed,
        emailRef: msg.id,
      });
    }
  }

  return transactions;
}

function extractBody(message: Record<string, unknown>): string | null {
  const payload = message.payload as Record<string, unknown> | undefined;
  if (!payload) return null;

  const decodeBase64Url = (data: string) => {
    const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
    return Buffer.from(normalized, "base64").toString("utf-8");
  };

  const stripHtml = (html: string) =>
    html
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const readPart = (part: Record<string, unknown>): string | null => {
    const mimeType = (part.mimeType as string | undefined) || "";
    const body = part.body as Record<string, unknown> | undefined;
    const data = body?.data as string | undefined;
    if (data) {
      const decoded = decodeBase64Url(data);
      if (mimeType.includes("text/html")) return stripHtml(decoded);
      return decoded;
    }
    const parts = part.parts as Array<Record<string, unknown>> | undefined;
    if (parts) {
      // Prefer text/plain first, then html fallback
      const plain = parts.find((p) =>
        ((p.mimeType as string | undefined) || "").includes("text/plain")
      );
      if (plain) {
        const content = readPart(plain);
        if (content) return content;
      }
      for (const p of parts) {
        const content = readPart(p);
        if (content) return content;
      }
    }
    return null;
  };

  return readPart(payload) || (payload.snippet as string) || null;
}
