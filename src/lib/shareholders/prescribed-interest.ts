import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getTaxYearConfig } from "@/lib/tax/rules";

export type PrescribedInterestResult = {
  totalInterest: number;
  daysOverdrawn: number;
  averageOverdrawnBalance: number;
  prescribedRate: number;
  hasBeenCharged: boolean;
};

/**
 * Calculate prescribed interest on a shareholder's overdrawn current account.
 *
 * NZ tax law requires companies to charge interest at the prescribed rate on
 * shareholder loans, or the shortfall is treated as a deemed dividend.
 *
 * In the shareholder current account:
 * - Positive amount = drawing (shareholder took money out)
 * - Negative amount = repayment/salary (shareholder put money in)
 * - Running balance positive = shareholder owes the company (overdrawn)
 */
export function calculatePrescribedInterest(
  businessId: string,
  shareholderId: string,
  taxYear: number
): PrescribedInterestResult {
  const config = getTaxYearConfig(taxYear);
  const prescribedRate = config.prescribedInterestRate;

  const db = getDb();

  // Get opening balance from prior year transactions
  const priorTransactions = db
    .select()
    .from(schema.shareholderTransactions)
    .where(
      and(
        eq(schema.shareholderTransactions.shareholder_id, shareholderId),
        eq(schema.shareholderTransactions.business_id, businessId),
        eq(schema.shareholderTransactions.tax_year, String(taxYear - 1))
      )
    )
    .all();
  let balance = priorTransactions.reduce((sum, t) => sum + t.amount, 0);

  // Get current year transactions
  const transactions = db
    .select()
    .from(schema.shareholderTransactions)
    .where(
      and(
        eq(schema.shareholderTransactions.shareholder_id, shareholderId),
        eq(schema.shareholderTransactions.business_id, businessId),
        eq(schema.shareholderTransactions.tax_year, String(taxYear))
      )
    )
    .all()
    .sort((a, b) => a.date.localeCompare(b.date));

  // Check if interest has been charged
  const hasBeenCharged = transactions.some(
    (t) => t.type === "other" && t.description?.toLowerCase().includes("prescribed interest")
  );

  // Build date→amount map
  const dateAmounts = new Map<string, number>();
  for (const t of transactions) {
    dateAmounts.set(t.date, (dateAmounts.get(t.date) || 0) + t.amount);
  }

  // Iterate through each day of the tax year
  const startDate = `${taxYear - 1}-04-01`;
  const endDate = `${taxYear}-03-31`;
  const current = new Date(startDate);
  const end = new Date(endDate);

  let totalInterest = 0;
  let daysOverdrawn = 0;
  let totalOverdrawnBalance = 0;

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);

    const dayAmount = dateAmounts.get(dateStr);
    if (dayAmount) {
      balance += dayAmount;
    }

    // Positive balance = shareholder owes company
    if (balance > 0) {
      totalInterest += (balance * prescribedRate) / 365;
      daysOverdrawn++;
      totalOverdrawnBalance += balance;
    }

    current.setDate(current.getDate() + 1);
  }

  return {
    totalInterest: Math.round(totalInterest * 100) / 100,
    daysOverdrawn,
    averageOverdrawnBalance: daysOverdrawn > 0
      ? Math.round((totalOverdrawnBalance / daysOverdrawn) * 100) / 100
      : 0,
    prescribedRate,
    hasBeenCharged,
  };
}
