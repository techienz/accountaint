/**
 * NZ bank CSV format detection and parsing.
 *
 * Supported banks: ASB, ANZ, Westpac, Kiwibank, BNZ
 * Each bank exports CSVs with different column layouts.
 * We detect the format from the header row, then parse accordingly.
 */

import { createHash } from "crypto";

export type ParsedTransaction = {
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // negative = debit, positive = credit
  balance: number | null;
  type: "debit" | "credit";
  dedup_hash: string;
};

type BankFormat = "asb" | "anz" | "westpac" | "kiwibank" | "bnz" | "unknown";

// ── CSV line parser (handles quoted fields) ─────────────────────────

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

// ── Format detection ────────────────────────────────────────────────

function detectFormat(headerLine: string): BankFormat {
  const lower = headerLine.toLowerCase();

  // ASB: "Date,Unique Id,Tran Type,Cheque Number,Payee,Memo,Amount"
  if (lower.includes("unique id") && lower.includes("tran type") && lower.includes("payee"))
    return "asb";

  // ANZ: "Type,Details,Particulars,Code,Reference,Amount,Date,ForeignCurrencyAmount,ConversionCharge"
  if (lower.includes("particulars") && lower.includes("code") && lower.includes("reference") && lower.includes("foreigncurrencyamount"))
    return "anz";

  // BNZ: "Date,Amount,Payee,Particulars,Code,Reference,Tran Type,This Party Account"
  if (lower.includes("this party account") || (lower.includes("tran type") && lower.includes("payee") && lower.includes("particulars")))
    return "bnz";

  // Kiwibank: "Account number,Date,Memo/Description,Source Code,TP ref,TP part,TP code,TP Other Party Name,Amount,Balance"
  if (lower.includes("memo/description") || lower.includes("tp ref") || lower.includes("tp other party"))
    return "kiwibank";

  // Westpac: "Date,Amount,Other Party,Description,Reference,Particulars,Analysis Code"
  if (lower.includes("other party") && lower.includes("analysis code"))
    return "westpac";

  // ANZ variant without foreign currency columns
  if (lower.includes("particulars") && lower.includes("code") && lower.includes("reference") && lower.includes("details"))
    return "anz";

  return "unknown";
}

// ── Date parsing ────────────────────────────────────────────────────

function parseDate(raw: string): string {
  const trimmed = raw.trim();

  // YYYY/MM/DD or YYYY-MM-DD
  if (/^\d{4}[/-]\d{2}[/-]\d{2}$/.test(trimmed)) {
    return trimmed.replace(/\//g, "-");
  }

  // DD/MM/YYYY or DD-MM-YYYY
  if (/^\d{2}[/-]\d{2}[/-]\d{4}$/.test(trimmed)) {
    const parts = trimmed.split(/[/-]/);
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }

  // D/MM/YYYY or DD/M/YYYY (variable length)
  const slashParts = trimmed.split(/[/-]/);
  if (slashParts.length === 3 && slashParts[2].length === 4) {
    const d = slashParts[0].padStart(2, "0");
    const m = slashParts[1].padStart(2, "0");
    return `${slashParts[2]}-${m}-${d}`;
  }

  return trimmed; // fallback
}

// ── Dedup hash ──────────────────────────────────────────────────────

function dedupHash(date: string, amount: number, description: string): string {
  const input = `${date}|${amount}|${description}`;
  return createHash("sha256").update(input).digest("hex");
}

// ── Bank-specific parsers ───────────────────────────────────────────

function parseASB(fields: string[]): ParsedTransaction | null {
  // Date,Unique Id,Tran Type,Cheque Number,Payee,Memo,Amount
  if (fields.length < 7) return null;
  const date = parseDate(fields[0]);
  const payee = fields[4] || "";
  const memo = fields[5] || "";
  const description = [payee, memo].filter(Boolean).join(" — ");
  const amount = parseFloat(fields[6]);
  if (isNaN(amount) || !date) return null;

  return {
    date,
    description,
    amount,
    balance: null,
    type: amount < 0 ? "debit" : "credit",
    dedup_hash: dedupHash(date, amount, description),
  };
}

function parseANZ(fields: string[], headerFields: string[]): ParsedTransaction | null {
  // Type,Details,Particulars,Code,Reference,Amount,Date[,ForeignCurrencyAmount,ConversionCharge]
  const iAmount = headerFields.findIndex((h) => h.toLowerCase() === "amount");
  const iDate = headerFields.findIndex((h) => h.toLowerCase() === "date");
  const iDetails = headerFields.findIndex((h) => h.toLowerCase() === "details");
  const iParticulars = headerFields.findIndex((h) => h.toLowerCase() === "particulars");
  const iCode = headerFields.findIndex((h) => h.toLowerCase() === "code");
  const iReference = headerFields.findIndex((h) => h.toLowerCase() === "reference");

  if (iAmount === -1 || iDate === -1) return null;

  const date = parseDate(fields[iDate] || "");
  const amount = parseFloat(fields[iAmount] || "");
  if (isNaN(amount) || !date) return null;

  const parts = [
    iDetails !== -1 ? fields[iDetails] : "",
    iParticulars !== -1 ? fields[iParticulars] : "",
    iCode !== -1 ? fields[iCode] : "",
    iReference !== -1 ? fields[iReference] : "",
  ].filter(Boolean);
  const description = parts.join(" ") || "Unknown";

  return {
    date,
    description,
    amount,
    balance: null,
    type: amount < 0 ? "debit" : "credit",
    dedup_hash: dedupHash(date, amount, description),
  };
}

function parseWestpac(fields: string[]): ParsedTransaction | null {
  // Date,Amount,Other Party,Description,Reference,Particulars,Analysis Code
  if (fields.length < 4) return null;
  const date = parseDate(fields[0]);
  const amount = parseFloat(fields[1]);
  if (isNaN(amount) || !date) return null;

  const otherParty = fields[2] || "";
  const desc = fields[3] || "";
  const description = [otherParty, desc].filter(Boolean).join(" — ") || "Unknown";

  return {
    date,
    description,
    amount,
    balance: null,
    type: amount < 0 ? "debit" : "credit",
    dedup_hash: dedupHash(date, amount, description),
  };
}

function parseKiwibank(fields: string[]): ParsedTransaction | null {
  // Account number,Date,Memo/Description,Source Code,TP ref,TP part,TP code,TP Other Party Name,Amount,Balance
  if (fields.length < 9) return null;
  const date = parseDate(fields[1]);
  const memo = fields[2] || "";
  const otherParty = fields[7] || "";
  const description = [otherParty, memo].filter(Boolean).join(" — ") || "Unknown";
  const amount = parseFloat(fields[8]);
  if (isNaN(amount) || !date) return null;

  const balance = fields.length > 9 ? parseFloat(fields[9]) : null;

  return {
    date,
    description,
    amount,
    balance: balance != null && !isNaN(balance) ? balance : null,
    type: amount < 0 ? "debit" : "credit",
    dedup_hash: dedupHash(date, amount, description),
  };
}

function parseBNZ(fields: string[]): ParsedTransaction | null {
  // Date,Amount,Payee,Particulars,Code,Reference,Tran Type,This Party Account
  if (fields.length < 3) return null;
  const date = parseDate(fields[0]);
  const amount = parseFloat(fields[1]);
  if (isNaN(amount) || !date) return null;

  const payee = fields[2] || "";
  const particulars = fields[3] || "";
  const description = [payee, particulars].filter(Boolean).join(" ") || "Unknown";

  return {
    date,
    description,
    amount,
    balance: null,
    type: amount < 0 ? "debit" : "credit",
    dedup_hash: dedupHash(date, amount, description),
  };
}

// ── Main parser ─────────────────────────────────────────────────────

export type ParseResult = {
  bank: BankFormat;
  transactions: ParsedTransaction[];
  skipped: number;
};

export function parseBankCSV(csvText: string): ParseResult {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) {
    return { bank: "unknown", transactions: [], skipped: 0 };
  }

  const bank = detectFormat(lines[0]);
  const headerFields = parseCSVLine(lines[0]);
  const transactions: ParsedTransaction[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const fields = parseCSVLine(lines[i]);
    let tx: ParsedTransaction | null = null;

    switch (bank) {
      case "asb":
        tx = parseASB(fields);
        break;
      case "anz":
        tx = parseANZ(fields, headerFields);
        break;
      case "westpac":
        tx = parseWestpac(fields);
        break;
      case "kiwibank":
        tx = parseKiwibank(fields);
        break;
      case "bnz":
        tx = parseBNZ(fields);
        break;
      case "unknown":
        // Try generic: assume first col is date, look for an amount column
        tx = tryGenericParse(fields, headerFields);
        break;
    }

    if (tx) {
      transactions.push(tx);
    } else {
      skipped++;
    }
  }

  // Sort by date ascending
  transactions.sort((a, b) => a.date.localeCompare(b.date));

  return { bank, transactions, skipped };
}

function tryGenericParse(
  fields: string[],
  headerFields: string[]
): ParsedTransaction | null {
  // Find date-like and amount-like columns
  let dateIdx = -1;
  let amountIdx = -1;
  let descIdx = -1;

  for (let i = 0; i < headerFields.length; i++) {
    const h = headerFields[i].toLowerCase();
    if (dateIdx === -1 && (h === "date" || h.includes("date"))) dateIdx = i;
    if (amountIdx === -1 && (h === "amount" || h.includes("amount"))) amountIdx = i;
    if (descIdx === -1 && (h === "description" || h === "payee" || h === "details" || h.includes("description") || h.includes("memo")))
      descIdx = i;
  }

  if (dateIdx === -1 || amountIdx === -1) return null;
  if (dateIdx >= fields.length || amountIdx >= fields.length) return null;

  const date = parseDate(fields[dateIdx]);
  const amount = parseFloat(fields[amountIdx]);
  if (isNaN(amount) || !date) return null;

  const description =
    descIdx !== -1 && descIdx < fields.length
      ? fields[descIdx] || "Unknown"
      : fields.filter((_, i) => i !== dateIdx && i !== amountIdx).join(" ").trim() || "Unknown";

  return {
    date,
    description,
    amount,
    balance: null,
    type: amount < 0 ? "debit" : "credit",
    dedup_hash: dedupHash(date, amount, description),
  };
}

export const BANK_LABELS: Record<BankFormat, string> = {
  asb: "ASB",
  anz: "ANZ",
  westpac: "Westpac",
  kiwibank: "Kiwibank",
  bnz: "BNZ",
  unknown: "Unknown format",
};
