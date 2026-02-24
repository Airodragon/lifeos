type ParsedStatementTxn = {
  date: Date;
  description: string;
  amount: number;
  type: "income" | "expense";
};

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result.map((v) => v.replace(/^"|"$/g, "").trim());
}

function parseFlexibleDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const direct = new Date(s);
  if (!Number.isNaN(direct.getTime())) return direct;

  const parts = s.split(/[\/\-.]/).map((p) => p.trim());
  if (parts.length === 3) {
    const [a, b, c] = parts;
    // dd/mm/yyyy
    const dd = parseInt(a, 10);
    const mm = parseInt(b, 10);
    const yyyy = parseInt(c.length === 2 ? `20${c}` : c, 10);
    if (!Number.isNaN(dd) && !Number.isNaN(mm) && !Number.isNaN(yyyy)) {
      const d = new Date(yyyy, mm - 1, dd);
      if (!Number.isNaN(d.getTime())) return d;
    }
  }
  return null;
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[,\s₹$]/g, "").trim();
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/\s+/g, "").replace(/[^a-z]/g, "");
}

export function parseBankStatementCsv(csvText: string): ParsedStatementTxn[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map(normalizeHeader);
  const idx = {
    date: headers.findIndex((h) => h.includes("date")),
    desc: headers.findIndex(
      (h) =>
        h.includes("description") ||
        h.includes("narration") ||
        h.includes("remark") ||
        h.includes("particular")
    ),
    amount: headers.findIndex((h) => h === "amount" || h.includes("txnamount")),
    debit: headers.findIndex((h) => h.includes("debit") || h.includes("withdrawal")),
    credit: headers.findIndex((h) => h.includes("credit") || h.includes("deposit")),
    drcr: headers.findIndex((h) => h.includes("type") || h.includes("drcr")),
  };

  const out: ParsedStatementTxn[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const dateRaw = idx.date >= 0 ? cols[idx.date] || "" : "";
    const descRaw = idx.desc >= 0 ? cols[idx.desc] || "" : "Imported transaction";
    const date = parseFlexibleDate(dateRaw);
    if (!date) continue;

    let amount = 0;
    let type: "income" | "expense" = "expense";
    const debit = idx.debit >= 0 ? parseAmount(cols[idx.debit] || "") : 0;
    const credit = idx.credit >= 0 ? parseAmount(cols[idx.credit] || "") : 0;
    const amt = idx.amount >= 0 ? parseAmount(cols[idx.amount] || "") : 0;
    const drcr = idx.drcr >= 0 ? String(cols[idx.drcr] || "").toLowerCase() : "";

    if (debit > 0 || credit > 0) {
      if (debit > 0) {
        amount = Math.abs(debit);
        type = "expense";
      } else {
        amount = Math.abs(credit);
        type = "income";
      }
    } else if (amt !== 0) {
      amount = Math.abs(amt);
      type =
        amt < 0 || drcr.includes("dr") || drcr.includes("debit")
          ? "expense"
          : "income";
    } else {
      continue;
    }

    out.push({
      date,
      description: descRaw || "Imported transaction",
      amount,
      type,
    });
  }
  return out;
}

