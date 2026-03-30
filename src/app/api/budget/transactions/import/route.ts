import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { previewImport, importTransactions } from "@/lib/budget/transactions";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.csv) {
    return NextResponse.json({ error: "csv field is required" }, { status: 400 });
  }

  if (body.preview) {
    const result = previewImport(body.csv);
    return NextResponse.json(result);
  }

  const result = importTransactions(
    session.user.id,
    body.csv,
    body.bank_account_id ?? null
  );

  return NextResponse.json(
    {
      bank: result.parseResult.bank,
      imported: result.imported,
      duplicates: result.duplicates,
      categorised: result.categorised,
      skipped: result.parseResult.skipped,
      batchId: result.batchId,
    },
    { status: 201 }
  );
}
