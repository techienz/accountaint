import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { calculateGstReturn } from "@/lib/gst/calculator";
import { getTaxYear } from "@/lib/tax/rules";
import type { XeroInvoice } from "@/lib/xero/types";

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

  // Load invoices from cache
  const cached = db
    .select()
    .from(schema.xeroCache)
    .where(eq(schema.xeroCache.business_id, business.id))
    .all()
    .find((c) => c.entity_type === "invoices");

  const invoices: XeroInvoice[] = cached
    ? (JSON.parse(cached.data)?.Invoices || [])
    : [];

  const taxConfig = getTaxYear(new Date());
  const gstRate = taxConfig?.gstRate || 0.15;
  const basis = (business.gst_basis as "invoice" | "payments") || "invoice";

  const result = calculateGstReturn(
    invoices,
    { from: periodFrom, to: periodTo },
    basis,
    gstRate
  );

  // Load filing status
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

  return NextResponse.json({
    ...result,
    filingStatus: filingRecord?.status || "not_started",
    filedDate: filingRecord?.filed_date || null,
  });
}
