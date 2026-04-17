import { eq, and, desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { decrypt } from "@/lib/encryption";

export { declareDividend } from "./declare";
export type { DeclareDividendInput, DeclareDividendResult } from "./declare";

export function getDividendDeclaration(id: string, businessId: string) {
  const db = getDb();

  const declaration = db
    .select()
    .from(schema.dividendDeclarations)
    .where(
      and(
        eq(schema.dividendDeclarations.id, id),
        eq(schema.dividendDeclarations.business_id, businessId)
      )
    )
    .get();

  if (!declaration) return null;

  // Get related shareholder transactions
  const transactions = db
    .select()
    .from(schema.shareholderTransactions)
    .where(eq(schema.shareholderTransactions.dividend_declaration_id, id))
    .all();

  // Get shareholder names
  const shareholders = db
    .select()
    .from(schema.shareholders)
    .where(eq(schema.shareholders.business_id, businessId))
    .all();

  const shareholderMap = new Map(
    shareholders.map((s) => [s.id, decrypt(s.name)])
  );

  return {
    ...declaration,
    transactions: transactions.map((t) => ({
      id: t.id,
      shareholder_id: t.shareholder_id,
      shareholder_name: shareholderMap.get(t.shareholder_id) ?? "Unknown",
      amount: Math.abs(t.amount),
      date: t.date,
    })),
  };
}

export function listDividendDeclarations(
  businessId: string,
  taxYear?: string
) {
  const db = getDb();

  let query = db
    .select()
    .from(schema.dividendDeclarations)
    .where(eq(schema.dividendDeclarations.business_id, businessId))
    .orderBy(desc(schema.dividendDeclarations.date));

  const declarations = taxYear
    ? query
        .all()
        .filter((d) => d.tax_year === taxYear)
    : query.all();

  return declarations.map((d) => ({
    id: d.id,
    resolution_number: d.resolution_number,
    date: d.date,
    tax_year: d.tax_year,
    total_amount: d.total_amount,
    document_id: d.document_id,
  }));
}
