import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { calculateProvisionalTax } from "@/lib/tax/provisional";
import { getNzTaxYear } from "@/lib/tax/rules";
import { prepareIR4 } from "@/lib/tax/ir4-prep";
import type { ProvisionalTaxMethod } from "@/lib/tax/rules/types";
import { v4 as uuid } from "uuid";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const method = business.provisional_tax_method as ProvisionalTaxMethod | null;
  if (!method) {
    return NextResponse.json({
      configured: false,
      message: "Provisional tax method not configured. Update your business settings.",
    });
  }

  const url = new URL(request.url);
  const taxYear =
    Number(url.searchParams.get("tax_year")) || getNzTaxYear(new Date());

  // Use prior year IR4 tax payable as RIT estimate
  let priorYearRIT = 0;
  try {
    const priorIR4 = await prepareIR4(business.id, String(taxYear - 1));
    priorYearRIT = priorIR4.taxPayable;
  } catch {
    // No prior year data — use 0
  }

  const schedule = calculateProvisionalTax(
    method,
    taxYear,
    priorYearRIT,
    business.balance_date
  );

  // Load payment records
  const db = getDb();
  const payments = await db
    .select()
    .from(schema.provisionalTaxPayments)
    .where(
      and(
        eq(schema.provisionalTaxPayments.business_id, business.id),
        eq(schema.provisionalTaxPayments.tax_year, String(taxYear))
      )
    );

  // Merge payments into schedule
  let totalPaid = 0;
  for (const inst of schedule.instalments) {
    const payment = payments.find(
      (p) => p.instalment_number === inst.number
    );
    if (payment?.amount_paid != null) {
      inst.amountPaid = payment.amount_paid;
      inst.paidDate = payment.paid_date;
      totalPaid += payment.amount_paid;
    }
  }
  schedule.totalPaid = totalPaid;
  schedule.balance = Math.round((schedule.totalDue - totalPaid) * 100) / 100;

  return NextResponse.json({ configured: true, schedule, priorYearRIT });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const body = await request.json();
  const { tax_year, instalment_number, amount_paid, paid_date, amount_due } = body;

  if (!tax_year || !instalment_number) {
    return NextResponse.json(
      { error: "tax_year and instalment_number required" },
      { status: 400 }
    );
  }

  const db = getDb();
  const [existing] = await db
    .select()
    .from(schema.provisionalTaxPayments)
    .where(
      and(
        eq(schema.provisionalTaxPayments.business_id, business.id),
        eq(schema.provisionalTaxPayments.tax_year, String(tax_year)),
        eq(schema.provisionalTaxPayments.instalment_number, instalment_number)
      )
    );

  if (existing) {
    await db
      .update(schema.provisionalTaxPayments)
      .set({
        amount_paid: amount_paid ?? existing.amount_paid,
        paid_date: paid_date ?? existing.paid_date,
        updated_at: new Date(),
      })
      .where(eq(schema.provisionalTaxPayments.id, existing.id));
  } else {
    await db.insert(schema.provisionalTaxPayments).values({
      id: uuid(),
      business_id: business.id,
      tax_year: String(tax_year),
      instalment_number,
      due_date: body.due_date || "",
      amount_due: amount_due || 0,
      amount_paid: amount_paid || null,
      paid_date: paid_date || null,
    });
  }

  return NextResponse.json({ success: true });
}
