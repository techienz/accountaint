import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { calculateGstReturnFromLedger } from "@/lib/gst/calculator";
import { getTaxYear } from "@/lib/tax/rules";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ period: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const { period } = await params;
  const [periodFrom, periodTo] = period.split("_");
  if (!periodFrom || !periodTo) {
    return NextResponse.json({ error: "Invalid period format" }, { status: 400 });
  }

  const db = getDb();

  const taxConfig = getTaxYear(new Date());
  const gstRate = taxConfig?.gstRate || 0.15;
  const basis = (business.gst_basis as "invoice" | "payments") || "invoice";

  // Migrated from invoice-based to ledger-based calc (audit #115). Captures
  // confirmed expenses + manual GST adjustments in addition to invoices.
  const result = calculateGstReturnFromLedger(
    business.id,
    { from: periodFrom, to: periodTo },
    basis,
    gstRate,
  );

  const periodKey = `${periodFrom}_${periodTo}`;
  const [filingRecord] = await db
    .select()
    .from(schema.filingStatus)
    .where(
      and(
        eq(schema.filingStatus.business_id, business.id),
        eq(schema.filingStatus.filing_type, "gst"),
        eq(schema.filingStatus.period_key, periodKey)
      )
    );

  // Empty result — return a zeroed shape so the worksheet still renders
  // cleanly. The reason is surfaced for the UI to optionally display.
  if ("empty" in result && result.empty) {
    return NextResponse.json({
      period: { from: periodFrom, to: periodTo },
      basis,
      gstRate,
      totalSales: 0,
      totalPurchases: 0,
      gstOnSales: 0,
      gstOnPurchases: 0,
      netGst: 0,
      lineItems: [],
      empty: true,
      emptyReason: result.reason,
      filingStatus: filingRecord?.status || "not_started",
      filedDate: filingRecord?.filed_date || null,
    });
  }

  return NextResponse.json({
    ...result,
    filingStatus: filingRecord?.status || "not_started",
    filedDate: filingRecord?.filed_date || null,
  });
}
