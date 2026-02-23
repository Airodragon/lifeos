import { google } from "googleapis";
import { decrypt } from "./encryption";
import { parseEmailTransaction } from "./openai";

interface EmailCredentials {
  accessToken: string;
  refreshToken: string | null;
}

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXTAUTH_URL}/api/email-sync/callback`
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
    "from:alerts@hdfcbank.net",
    "from:alerts@icicibank.com",
    "from:noreply@axisbank.com",
    "from:auto-confirm@amazon.in",
    "from:noreply@upi",
    "from:transaction@kotak",
    "from:alerts@sbi",
  ];

  const query = `(${senderPatterns.join(" OR ")}) after:${afterDate}`;

  const response = await gmail.users.messages.list({
    userId: "me",
    q: query,
    maxResults: 50,
  });

  const messages = response.data.messages || [];
  const transactions = [];

  for (const msg of messages) {
    const full = await gmail.users.messages.get({
      userId: "me",
      id: msg.id!,
      format: "full",
    });

    const body = extractBody(full.data as unknown as Record<string, unknown>);
    if (!body) continue;

    const parsed = await parseEmailTransaction(body);
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

  const parts = payload.parts as Array<Record<string, unknown>> | undefined;
  if (parts) {
    for (const part of parts) {
      if (part.mimeType === "text/plain") {
        const body = part.body as Record<string, unknown> | undefined;
        const data = body?.data as string | undefined;
        if (data) {
          return Buffer.from(data, "base64").toString("utf-8");
        }
      }
    }
  }

  const body = payload.body as Record<string, unknown> | undefined;
  const data = body?.data as string | undefined;
  if (data) {
    return Buffer.from(data, "base64").toString("utf-8");
  }

  return (payload.snippet as string) ?? null;
}
