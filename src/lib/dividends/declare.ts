import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { decrypt } from "@/lib/encryption";
import { getNzTaxYear } from "@/lib/tax/rules";
import { postShareholderJournal } from "@/lib/ledger/post";
import { createDocumentFromUpload } from "@/lib/documents/upload";
import { generateBoardResolutionPdf } from "./resolution-pdf";
import type { ResolutionPdfData } from "./resolution-pdf";

export type DeclareDividendInput = {
  date: string; // YYYY-MM-DD
  totalAmount: number;
  notes?: string;
};

export type DeclareDividendResult = {
  declarationId: string;
  resolutionNumber: string;
  documentId: string;
  transactionIds: string[];
  totalAmount: number;
};

function generateResolutionNumber(businessId: string): string {
  const db = getDb();
  const biz = db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, businessId))
    .get();
  if (!biz) throw new Error("Business not found");

  const nextNum = biz.next_resolution_number ?? 1;
  const number = `BR-${String(nextNum).padStart(3, "0")}`;

  db.update(schema.businesses)
    .set({ next_resolution_number: nextNum + 1 })
    .where(eq(schema.businesses.id, businessId))
    .run();

  return number;
}

function distributeByOwnership(
  totalAmount: number,
  shareholders: Array<{ id: string; ownership_percentage: number }>
): Array<{ shareholderId: string; amount: number }> {
  const sorted = [...shareholders].sort(
    (a, b) => b.ownership_percentage - a.ownership_percentage
  );
  let remaining = totalAmount;

  return sorted.map((sh, i) => {
    if (i === sorted.length - 1) {
      return {
        shareholderId: sh.id,
        amount: Math.round(remaining * 100) / 100,
      };
    }
    const amount =
      Math.round(((totalAmount * sh.ownership_percentage) / 100) * 100) / 100;
    remaining -= amount;
    return { shareholderId: sh.id, amount };
  });
}

function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("en-NZ", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function declareDividend(
  businessId: string,
  input: DeclareDividendInput
): Promise<DeclareDividendResult> {
  const db = getDb();

  // 1. Load business
  const business = db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, businessId))
    .get();
  if (!business) throw new Error("Business not found");

  // 2. Load shareholders
  const shareholders = db
    .select()
    .from(schema.shareholders)
    .where(eq(schema.shareholders.business_id, businessId))
    .all();
  if (shareholders.length === 0) {
    throw new Error("No shareholders found. Add shareholders before declaring a dividend.");
  }

  const directors = shareholders.filter((s) => s.is_director);

  // 3. Generate resolution number
  const resolutionNumber = generateResolutionNumber(businessId);

  // 4. Calculate per-shareholder amounts
  const allocations = distributeByOwnership(input.totalAmount, shareholders);

  // 5. Determine tax year from the dividend date
  const [y, m, d] = input.date.split("-").map(Number);
  const taxYear = String(getNzTaxYear(new Date(y, m - 1, d)));

  // 6. Create dividend declaration
  const declarationId = uuid();
  db.insert(schema.dividendDeclarations)
    .values({
      id: declarationId,
      business_id: businessId,
      resolution_number: resolutionNumber,
      date: input.date,
      tax_year: taxYear,
      total_amount: input.totalAmount,
      solvency_confirmed: true,
      notes: input.notes ?? null,
    })
    .run();

  // 7. Create shareholder transactions + post journals
  const transactionIds: string[] = [];
  for (const alloc of allocations) {
    const txId = uuid();
    transactionIds.push(txId);

    db.insert(schema.shareholderTransactions)
      .values({
        id: txId,
        business_id: businessId,
        shareholder_id: alloc.shareholderId,
        tax_year: taxYear,
        date: input.date,
        type: "dividend",
        description: `Dividend per ${resolutionNumber}`,
        amount: -alloc.amount, // negative = credit to shareholder
        dividend_declaration_id: declarationId,
      })
      .run();

    try {
      postShareholderJournal(businessId, {
        id: txId,
        date: input.date,
        type: "dividend",
        amount: -alloc.amount,
        description: `Dividend per ${resolutionNumber}`,
      });
    } catch (err) {
      console.error("Failed to post dividend journal:", err);
    }
  }

  // 8. Generate board resolution PDF
  const pdfData: ResolutionPdfData = {
    companyName: business.name,
    companyNumber: business.company_number
      ? decrypt(business.company_number)
      : null,
    resolutionNumber,
    date: formatDateDisplay(input.date),
    isSoleDirector: directors.length <= 1,
    directors: directors.length > 0
      ? directors.map((d) => ({ name: decrypt(d.name) }))
      : shareholders.slice(0, 1).map((s) => ({ name: decrypt(s.name) })),
    shareholders: allocations.map((alloc) => {
      const sh = shareholders.find((s) => s.id === alloc.shareholderId)!;
      return {
        name: decrypt(sh.name),
        ownershipPercentage: sh.ownership_percentage,
        amount: alloc.amount,
      };
    }),
    totalAmount: input.totalAmount,
    taxYear,
    notes: input.notes ?? null,
  };

  const pdfBuffer = await generateBoardResolutionPdf(pdfData);

  // 9. Store in document vault
  const doc = createDocumentFromUpload(
    businessId,
    {
      name: `Board Resolution ${resolutionNumber}.pdf`,
      type: "application/pdf",
      buffer: pdfBuffer,
    },
    {
      folderName: "Board Resolutions",
      documentType: "board_resolution",
      linkedEntityType: "dividend_declaration",
      linkedEntityId: declarationId,
      taxYear,
      description: `Dividend declaration ${resolutionNumber} - ${formatDateDisplay(input.date)}`,
    }
  );

  // 10. Update declaration with document_id
  db.update(schema.dividendDeclarations)
    .set({ document_id: doc.id })
    .where(eq(schema.dividendDeclarations.id, declarationId))
    .run();

  return {
    declarationId,
    resolutionNumber,
    documentId: doc.id,
    transactionIds,
    totalAmount: input.totalAmount,
  };
}
