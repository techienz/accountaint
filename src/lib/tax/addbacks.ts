/**
 * Identifies common non-deductible expenses from P&L data.
 * Scans account names for patterns that typically require tax adjustment.
 */

export type AddBack = {
  accountName: string;
  amount: number;
  reason: string;
  suggested: boolean; // auto-detected vs manually added
};

const ADD_BACK_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /entertainment/i, reason: "50% entertainment non-deductible" },
  { pattern: /penalty|penalties|fine/i, reason: "Penalties and fines non-deductible" },
  { pattern: /donation/i, reason: "Donations — claim via tax credits instead" },
  { pattern: /private|personal/i, reason: "Personal expenses non-deductible" },
  { pattern: /drawings/i, reason: "Owner drawings — not a business expense" },
  { pattern: /political/i, reason: "Political donations non-deductible" },
  { pattern: /life insurance/i, reason: "Life insurance premiums — generally non-deductible for company" },
];

export function identifyAddBacks(
  plData: { accountName: string; amount: number }[]
): AddBack[] {
  const addBacks: AddBack[] = [];

  for (const account of plData) {
    for (const { pattern, reason } of ADD_BACK_PATTERNS) {
      if (pattern.test(account.accountName)) {
        let adjustedAmount = account.amount;
        // Entertainment is 50% non-deductible
        if (/entertainment/i.test(account.accountName)) {
          adjustedAmount = Math.round(account.amount * 0.5 * 100) / 100;
        }
        addBacks.push({
          accountName: account.accountName,
          amount: adjustedAmount,
          reason,
          suggested: true,
        });
        break;
      }
    }
  }

  return addBacks;
}
