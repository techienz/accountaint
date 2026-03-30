import { getDb } from "@/lib/db";
import { shareholderTransactions } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";

export type TransactionWithBalance = {
  id: string;
  date: string;
  type: string;
  description: string | null;
  amount: number;
  runningBalance: number;
};

export type ShareholderBalance = {
  transactions: TransactionWithBalance[];
  closingBalance: number;
  isOverdrawn: boolean;
  minBalance: number;
};

export async function getRunningBalance(
  shareholderId: string,
  taxYear: string,
  businessId: string
): Promise<ShareholderBalance> {
  const db = getDb();

  const txns = await db
    .select()
    .from(shareholderTransactions)
    .where(
      and(
        eq(shareholderTransactions.shareholder_id, shareholderId),
        eq(shareholderTransactions.tax_year, taxYear),
        eq(shareholderTransactions.business_id, businessId)
      )
    )
    .orderBy(asc(shareholderTransactions.date), asc(shareholderTransactions.created_at));

  let balance = 0;
  let minBalance = 0;
  const transactions: TransactionWithBalance[] = txns.map((t) => {
    balance += t.amount;
    minBalance = Math.min(minBalance, balance);
    return {
      id: t.id,
      date: t.date,
      type: t.type,
      description: t.description,
      amount: t.amount,
      runningBalance: Math.round(balance * 100) / 100,
    };
  });

  return {
    transactions,
    closingBalance: Math.round(balance * 100) / 100,
    isOverdrawn: balance < 0,
    minBalance: Math.round(minBalance * 100) / 100,
  };
}
