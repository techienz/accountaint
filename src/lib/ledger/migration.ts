import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { seedChartOfAccounts, listAccounts, hasChartOfAccounts } from "./accounts";
import { createJournalEntry } from "./journals";
import type { JournalLineInput } from "./types";

type XeroBSRow = {
  RowType: string;
  Cells?: Array<{ Value: string }>;
};

type XeroBSSection = {
  RowType: string;
  Title?: string;
  Rows?: XeroBSRow[];
};

export type AccountMapping = {
  xeroName: string;
  xeroAmount: number;
  localAccount: { id: string; code: string; name: string } | null;
  matched: boolean;
};

export type MigrationResult = {
  journalEntryId: string | null;
  mappings: AccountMapping[];
  matchedCount: number;
  unmatchedCount: number;
  totalDebits: number;
  totalCredits: number;
  error?: string;
};

/**
 * Ensure the business has a Chart of Accounts. Seeds the default NZ COA if not.
 */
export function seedCoaIfNeeded(businessId: string): {
  seeded: boolean;
  accountCount: number;
} {
  if (hasChartOfAccounts(businessId)) {
    const accounts = listAccounts(businessId);
    return { seeded: false, accountCount: accounts.length };
  }

  const count = seedChartOfAccounts(businessId);
  return { seeded: true, accountCount: count };
}

/**
 * Import opening balances from the Xero balance sheet cache.
 *
 * Reads the Xero balance sheet, maps account names to local COA accounts,
 * and creates a single "Opening Balances" journal entry.
 *
 * Asset accounts are debits, liability/equity accounts are credits.
 */
export function importOpeningBalances(
  businessId: string,
  asAtDate: string
): MigrationResult {
  // Ensure COA exists
  seedCoaIfNeeded(businessId);

  // Read Xero balance sheet from cache
  const db = getDb();
  const cache = db
    .select()
    .from(schema.xeroCache)
    .where(
      and(
        eq(schema.xeroCache.business_id, businessId),
        eq(schema.xeroCache.entity_type, "balance_sheet")
      )
    )
    .get();

  if (!cache?.data) {
    return {
      journalEntryId: null,
      mappings: [],
      matchedCount: 0,
      unmatchedCount: 0,
      totalDebits: 0,
      totalCredits: 0,
      error: "No Xero balance sheet found in cache. Sync Xero first.",
    };
  }

  let bsData: { Reports: Array<{ Rows: XeroBSSection[] }> };
  try {
    bsData = JSON.parse(cache.data);
  } catch {
    return {
      journalEntryId: null,
      mappings: [],
      matchedCount: 0,
      unmatchedCount: 0,
      totalDebits: 0,
      totalCredits: 0,
      error: "Failed to parse Xero balance sheet data.",
    };
  }

  const report = bsData?.Reports?.[0];
  if (!report?.Rows) {
    return {
      journalEntryId: null,
      mappings: [],
      matchedCount: 0,
      unmatchedCount: 0,
      totalDebits: 0,
      totalCredits: 0,
      error: "Xero balance sheet has no data.",
    };
  }

  // Get local accounts for mapping
  const localAccounts = listAccounts(businessId);

  // Parse balance sheet sections and build account mappings
  const mappings: AccountMapping[] = [];
  const journalLines: JournalLineInput[] = [];

  for (const section of report.Rows) {
    if (section.RowType !== "Section" || !section.Title || !section.Rows) {
      continue;
    }

    const sectionTitle = section.Title.toLowerCase();
    const isAsset = sectionTitle.includes("asset");
    const isLiability = sectionTitle.includes("liabilit");
    const isEquity = sectionTitle.includes("equity");

    if (!isAsset && !isLiability && !isEquity) continue;

    for (const row of section.Rows) {
      // Only process regular Row entries, skip SummaryRow
      if (row.RowType !== "Row" || !row.Cells || row.Cells.length < 2) {
        continue;
      }

      const accountName = row.Cells[0].Value;
      const amount = parseFloat(row.Cells[1].Value || "0");

      if (!accountName || amount === 0) continue;

      // Try to match to a local account by name
      const localAccount = findBestMatch(accountName, localAccounts, isAsset, isLiability, isEquity);

      const mapping: AccountMapping = {
        xeroName: accountName,
        xeroAmount: amount,
        localAccount: localAccount
          ? { id: localAccount.id, code: localAccount.code, name: localAccount.name }
          : null,
        matched: !!localAccount,
      };
      mappings.push(mapping);

      if (localAccount) {
        // Assets are debits (positive amounts), liabilities/equity are credits
        if (isAsset) {
          journalLines.push({
            account_id: localAccount.id,
            debit: Math.abs(amount),
            credit: 0,
            description: `Opening balance: ${accountName}`,
          });
        } else {
          // Liability and equity are credits
          journalLines.push({
            account_id: localAccount.id,
            debit: 0,
            credit: Math.abs(amount),
            description: `Opening balance: ${accountName}`,
          });
        }
      }
    }
  }

  const matchedCount = mappings.filter((m) => m.matched).length;
  const unmatchedCount = mappings.filter((m) => !m.matched).length;

  if (journalLines.length < 2) {
    return {
      journalEntryId: null,
      mappings,
      matchedCount,
      unmatchedCount,
      totalDebits: 0,
      totalCredits: 0,
      error:
        journalLines.length === 0
          ? "No accounts could be matched. Review your Chart of Accounts."
          : "Need at least 2 matched accounts to create a balanced journal entry.",
    };
  }

  // Check balance — assets should equal liabilities + equity
  const totalDebits = Math.round(
    journalLines.reduce((s, l) => s + l.debit, 0) * 100
  ) / 100;
  const totalCredits = Math.round(
    journalLines.reduce((s, l) => s + l.credit, 0) * 100
  ) / 100;
  const diff = Math.round((totalDebits - totalCredits) * 100) / 100;

  // If unbalanced, add a rounding adjustment to Retained Earnings
  if (Math.abs(diff) > 0.001) {
    const retainedEarnings = localAccounts.find(
      (a: { code: string; name: string }) =>
        a.code === "3200" || a.name.toLowerCase().includes("retained earnings")
    );
    if (retainedEarnings) {
      if (diff > 0) {
        // More debits than credits — add credit to retained earnings
        journalLines.push({
          account_id: retainedEarnings.id,
          debit: 0,
          credit: Math.abs(diff),
          description: "Opening balance: rounding adjustment",
        });
      } else {
        // More credits than debits — add debit to retained earnings
        journalLines.push({
          account_id: retainedEarnings.id,
          debit: Math.abs(diff),
          credit: 0,
          description: "Opening balance: rounding adjustment",
        });
      }
    }
  }

  // Create the journal entry
  let journalEntryId: string | null = null;
  try {
    journalEntryId = createJournalEntry(businessId, {
      date: asAtDate,
      description: "Opening Balances imported from Xero",
      source_type: "opening_balance",
      lines: journalLines,
    });
  } catch (err) {
    return {
      journalEntryId: null,
      mappings,
      matchedCount,
      unmatchedCount,
      totalDebits,
      totalCredits,
      error: `Failed to create journal entry: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const finalDebits = Math.round(
    journalLines.reduce((s, l) => s + l.debit, 0) * 100
  ) / 100;
  const finalCredits = Math.round(
    journalLines.reduce((s, l) => s + l.credit, 0) * 100
  ) / 100;

  return {
    journalEntryId,
    mappings,
    matchedCount,
    unmatchedCount,
    totalDebits: finalDebits,
    totalCredits: finalCredits,
  };
}

/**
 * Best-effort name matching from Xero account name to local COA account.
 * Tries exact match, then normalised match, then keyword match.
 */
function findBestMatch(
  xeroName: string,
  localAccounts: Array<{
    id: string;
    code: string;
    name: string;
    type: string;
    sub_type: string | null;
  }>,
  isAsset: boolean,
  isLiability: boolean,
  isEquity: boolean
): (typeof localAccounts)[number] | null {
  const normalise = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const xeroNorm = normalise(xeroName);

  // Filter by expected type
  const typeFilter = isAsset
    ? "asset"
    : isLiability
      ? "liability"
      : "equity";
  const sameTypeAccounts = localAccounts.filter((a) => a.type === typeFilter);
  const allAccounts = localAccounts;

  // 1. Exact name match (same type first, then any type)
  for (const pool of [sameTypeAccounts, allAccounts]) {
    const exact = pool.find(
      (a) => normalise(a.name) === xeroNorm
    );
    if (exact) return exact;
  }

  // 2. Common name mappings
  const nameMap: Record<string, string> = {
    "accounts receivable": "1200",
    "accounts payable": "2100",
    "gst": "2200",
    "gst payable": "2200",
    "gst receivable": "1300",
    "cash at bank": "1100",
    "bank": "1100",
    "fixed assets": "1500",
    "accumulated depreciation": "1510",
    "share capital": "3100",
    "retained earnings": "3200",
    "income tax payable": "2400",
    "shareholder current account": "2500",
  };

  const mappedCode = nameMap[xeroNorm];
  if (mappedCode) {
    const found = localAccounts.find((a) => a.code === mappedCode);
    if (found) return found;
  }

  // 3. Substring match — check if xero name contains or is contained in local name
  for (const pool of [sameTypeAccounts, allAccounts]) {
    const sub = pool.find((a) => {
      const localNorm = normalise(a.name);
      return localNorm.includes(xeroNorm) || xeroNorm.includes(localNorm);
    });
    if (sub) return sub;
  }

  // 4. Keyword overlap — find account with best word overlap
  const xeroWords = new Set(xeroNorm.split(" ").filter((w) => w.length > 2));
  let bestMatch: (typeof localAccounts)[number] | null = null;
  let bestScore = 0;

  for (const account of sameTypeAccounts) {
    const localWords = new Set(
      normalise(account.name).split(" ").filter((w) => w.length > 2)
    );
    let overlap = 0;
    for (const word of xeroWords) {
      if (localWords.has(word)) overlap++;
    }
    const score = overlap / Math.max(xeroWords.size, localWords.size);
    if (score > bestScore && score >= 0.5) {
      bestScore = score;
      bestMatch = account;
    }
  }

  return bestMatch;
}
