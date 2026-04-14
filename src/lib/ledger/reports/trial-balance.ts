import { getTrialBalance } from "../journals";

export type TrialBalanceRow = {
  account_id: string;
  code: string;
  name: string;
  type: string;
  sub_type: string;
  debit: number;
  credit: number;
  balance: number;
};

export type TrialBalanceReport = {
  rows: TrialBalanceRow[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
};

/**
 * Generate a trial balance report from journal entries.
 */
export function generateTrialBalance(
  businessId: string,
  options?: { from?: string; to?: string }
): TrialBalanceReport {
  const rows = getTrialBalance(businessId, options);

  const totalDebit = Math.round(rows.reduce((sum, r) => sum + r.debit, 0) * 100) / 100;
  const totalCredit = Math.round(rows.reduce((sum, r) => sum + r.credit, 0) * 100) / 100;

  return {
    rows,
    totalDebit,
    totalCredit,
    isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
  };
}
