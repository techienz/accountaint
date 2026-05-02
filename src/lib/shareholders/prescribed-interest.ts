import { eq, and } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { getPrescribedInterestRate } from "@/lib/tax/rules";

export type PrescribedInterestRateBreakdown = {
  from: string;          // YYYY-MM-DD inclusive
  to: string;            // YYYY-MM-DD inclusive
  rate: number;
  daysOverdrawn: number;
  interestAccrued: number;
};

export type PrescribedInterestResult = {
  totalInterest: number;
  daysOverdrawn: number;
  averageOverdrawnBalance: number;
  /**
   * Effective rate observed across the year — for backward compatibility
   * with the UI that previously assumed a single annual rate. Computed as
   * weighted average of quarter rates by days-overdrawn so the displayed
   * number isn't misleading. UI should prefer rateBreakdown when shown.
   */
  prescribedRate: number;
  /**
   * Per-quarter breakdown so the UI can show "Q1 @ 7.38%, Q2 @ 6.67%..."
   * rather than a single misleading average. Audit #77.
   */
  rateBreakdown: PrescribedInterestRateBreakdown[];
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
  // Per-quarter rate breakdown — IRD publishes quarterly, so a tax year
  // can span up to four different rates. Audit #77.
  const breakdownByRate = new Map<number, { from: string; to: string; rate: number; daysOverdrawn: number; interestAccrued: number }>();
  let weightedRateSum = 0; // for the effective-rate display

  while (current <= end) {
    const dateStr = current.toISOString().slice(0, 10);

    const dayAmount = dateAmounts.get(dateStr);
    if (dayAmount) {
      balance += dayAmount;
    }

    // Positive balance = shareholder owes company
    if (balance > 0) {
      const rateForDay = getPrescribedInterestRate(current);
      const dayInterest = (balance * rateForDay) / 365;
      totalInterest += dayInterest;
      daysOverdrawn++;
      totalOverdrawnBalance += balance;
      weightedRateSum += rateForDay;

      const existing = breakdownByRate.get(rateForDay);
      if (existing) {
        existing.to = dateStr;
        existing.daysOverdrawn += 1;
        existing.interestAccrued += dayInterest;
      } else {
        breakdownByRate.set(rateForDay, {
          from: dateStr,
          to: dateStr,
          rate: rateForDay,
          daysOverdrawn: 1,
          interestAccrued: dayInterest,
        });
      }
    }

    current.setDate(current.getDate() + 1);
  }

  const rateBreakdown = Array.from(breakdownByRate.values())
    .map((b) => ({
      from: b.from,
      to: b.to,
      rate: b.rate,
      daysOverdrawn: b.daysOverdrawn,
      interestAccrued: Math.round(b.interestAccrued * 100) / 100,
    }))
    .sort((a, b) => a.from.localeCompare(b.from));

  // Effective rate = weighted average across overdrawn days. If never
  // overdrawn, fall back to today's rate so the UI has something to show.
  const effectiveRate = daysOverdrawn > 0
    ? weightedRateSum / daysOverdrawn
    : getPrescribedInterestRate(new Date());

  return {
    totalInterest: Math.round(totalInterest * 100) / 100,
    daysOverdrawn,
    averageOverdrawnBalance: daysOverdrawn > 0
      ? Math.round((totalOverdrawnBalance / daysOverdrawn) * 100) / 100
      : 0,
    prescribedRate: Math.round(effectiveRate * 10000) / 10000,
    rateBreakdown,
    hasBeenCharged,
  };
}
