import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { incomeTaxPrep, shareholders } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { getNzTaxYear } from "@/lib/tax/rules";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const url = new URL(request.url);
  const taxYear = url.searchParams.get("tax_year") || String(getNzTaxYear(new Date()));

  const db = getDb();

  // Get IR4 status
  const [ir4] = await db
    .select()
    .from(incomeTaxPrep)
    .where(
      and(
        eq(incomeTaxPrep.business_id, business.id),
        eq(incomeTaxPrep.tax_year, taxYear),
        eq(incomeTaxPrep.return_type, "IR4")
      )
    );

  // Get shareholders with IR3 status
  const shRows = await db
    .select()
    .from(shareholders)
    .where(eq(shareholders.business_id, business.id));

  const shareholderStatuses = await Promise.all(
    shRows.map(async (s) => {
      const [ir3] = await db
        .select()
        .from(incomeTaxPrep)
        .where(
          and(
            eq(incomeTaxPrep.business_id, business.id),
            eq(incomeTaxPrep.tax_year, taxYear),
            eq(incomeTaxPrep.return_type, "IR3"),
            eq(incomeTaxPrep.shareholder_id, s.id)
          )
        );

      return {
        id: s.id,
        name: decrypt(s.name),
        ir3Status: ir3?.status || "not_started",
      };
    })
  );

  return NextResponse.json({
    taxYear,
    ir4Status: ir4?.status || "not_started",
    shareholders: shareholderStatuses,
  });
}
