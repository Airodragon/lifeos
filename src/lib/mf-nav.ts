interface MfScheme {
  schemeCode: string;
  schemeName: string;
}

interface MfNavQuote {
  schemeCode: string;
  schemeName: string;
  nav: number;
  navDate: string;
}

const MF_LIST_URL = "https://api.mfapi.in/mf";
const MF_NAV_URL = "https://api.mfapi.in/mf";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

let mfSchemeCache: { fetchedAt: number; schemes: MfScheme[] } | null = null;

function normalizeScheme(s: unknown): MfScheme | null {
  if (!s || typeof s !== "object") return null;
  const item = s as Record<string, unknown>;
  const code = String(item.schemeCode ?? "").trim();
  const name = String(item.schemeName ?? "").trim();
  if (!code || !name) return null;
  return { schemeCode: code, schemeName: name };
}

export async function listMfSchemes(): Promise<MfScheme[]> {
  if (mfSchemeCache && Date.now() - mfSchemeCache.fetchedAt < CACHE_TTL_MS) {
    return mfSchemeCache.schemes;
  }
  const res = await fetch(MF_LIST_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("MF scheme list unavailable");
  const payload = await res.json();
  const schemes = Array.isArray(payload)
    ? payload.map(normalizeScheme).filter(Boolean) as MfScheme[]
    : [];
  mfSchemeCache = { fetchedAt: Date.now(), schemes };
  return schemes;
}

export async function searchMfSchemes(query: string, limit = 12): Promise<MfScheme[]> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const schemes = await listMfSchemes();

  type Ranked = { scheme: MfScheme; score: number };
  const ranked: Ranked[] = [];

  for (const s of schemes) {
    const name = s.schemeName.toLowerCase();
    const code = s.schemeCode.toLowerCase();

    let score = 0;
    if (name === q || code === q) score = 100;              // exact match
    else if (name.startsWith(q)) score = 80;                // name starts with query
    else if (code.startsWith(q)) score = 70;                // code starts with query
    else if (name.includes(` ${q}`)) score = 60;            // query is a word in name
    else if (name.includes(q)) score = 40;                  // name contains query
    else if (code.includes(q)) score = 20;                  // code contains query

    if (score > 0) ranked.push({ scheme: s, score });
  }

  return ranked
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.scheme);
}


export async function getLatestMfNav(schemeCode: string): Promise<MfNavQuote | null> {
  const code = String(schemeCode || "").trim();
  if (!code) return null;
  const res = await fetch(`${MF_NAV_URL}/${encodeURIComponent(code)}`, { cache: "no-store" });
  if (!res.ok) return null;
  const payload = await res.json().catch(() => null) as
    | {
        meta?: { scheme_name?: string };
        data?: Array<{ nav?: string; date?: string }>;
      }
    | null;
  if (!payload?.data?.length) return null;
  const nav = parseFloat(String(payload.data[0].nav ?? "0"));
  const navDate = String(payload.data[0].date ?? "");
  if (!Number.isFinite(nav) || nav <= 0) return null;
  return {
    schemeCode: code,
    schemeName: String(payload.meta?.scheme_name ?? code),
    nav,
    navDate,
  };
}
