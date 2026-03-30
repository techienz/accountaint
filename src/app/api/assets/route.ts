import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assets } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { listAssets } from "@/lib/assets/register";
import { getTaxYearConfig, getNzTaxYear } from "@/lib/tax/rules";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const assetList = await listAssets(business.id);
  return NextResponse.json(assetList);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const body = await request.json();
  const {
    name,
    category,
    purchase_date,
    cost,
    depreciation_method,
    depreciation_rate,
    notes,
  } = body;

  if (!name || !category || !purchase_date || cost == null || !depreciation_method || depreciation_rate == null) {
    return NextResponse.json(
      { error: "name, category, purchase_date, cost, depreciation_method, and depreciation_rate are required" },
      { status: 400 }
    );
  }

  const taxYear = getNzTaxYear(new Date());
  const config = getTaxYearConfig(taxYear);
  const isLowValue = cost < config.lowValueAssetThreshold;

  const db = getDb();
  const id = crypto.randomUUID();

  await db.insert(assets).values({
    id,
    business_id: business.id,
    name,
    category,
    purchase_date,
    cost,
    depreciation_method,
    depreciation_rate,
    is_low_value: isLowValue,
    notes: notes || null,
  });

  return NextResponse.json({ id, is_low_value: isLowValue }, { status: 201 });
}
