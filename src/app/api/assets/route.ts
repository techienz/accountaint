import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { assets, expenses } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
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

  const contentType = request.headers.get("content-type") || "";
  let body: Record<string, unknown>;
  let receiptFile: File | null = null;

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    body = Object.fromEntries(
      Array.from(formData.entries()).filter(([, v]) => typeof v === "string")
    ) as Record<string, unknown>;
    body.cost = Number(body.cost);
    body.depreciation_rate = Number(body.depreciation_rate);
    const file = formData.get("receipt");
    if (file instanceof File && file.size > 0) {
      receiptFile = file;
    }
  } else {
    body = await request.json();
  }

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
  const isLowValue = (cost as number) < config.lowValueAssetThreshold;

  const db = getDb();
  const id = crypto.randomUUID();
  const businessId = business.id;

  db.insert(assets).values({
    id,
    business_id: businessId,
    name: name as string,
    category: category as string,
    purchase_date: purchase_date as string,
    cost: cost as number,
    depreciation_method: depreciation_method as "DV" | "SL",
    depreciation_rate: depreciation_rate as number,
    is_low_value: isLowValue,
    notes: (notes as string) || null,
  }).run();

  // Save receipt file if provided
  if (receiptFile) {
    const ext = receiptFile.name.split(".").pop() || "bin";
    const receiptFilename = `asset-${id}.${ext}`;
    const receiptDir = path.join(process.cwd(), "data/receipts", businessId);
    fs.mkdirSync(receiptDir, { recursive: true });
    const buffer = Buffer.from(await receiptFile.arrayBuffer());
    fs.writeFileSync(path.join(receiptDir, receiptFilename), buffer);

    db.update(assets)
      .set({ receipt_path: receiptFilename, receipt_mime: receiptFile.type })
      .where(eq(assets.id, id))
      .run();
  }

  // Link back to source expense if provided
  const fromExpenseId = body.from_expense_id as string | undefined;
  if (fromExpenseId) {
    db.update(expenses)
      .set({ linked_asset_id: id })
      .where(
        and(
          eq(expenses.id, fromExpenseId),
          eq(expenses.business_id, businessId)
        )
      )
      .run();

    // Copy expense receipt to asset if asset doesn't already have one
    if (!receiptFile) {
      const expense = db
        .select()
        .from(expenses)
        .where(eq(expenses.id, fromExpenseId))
        .get();
      if (expense?.receipt_path) {
        const srcPath = path.join(process.cwd(), "data/receipts", businessId, expense.receipt_path);
        if (fs.existsSync(srcPath)) {
          const ext = expense.receipt_path.split(".").pop() || "bin";
          const assetReceiptName = `asset-${id}.${ext}`;
          const destPath = path.join(process.cwd(), "data/receipts", businessId, assetReceiptName);
          fs.copyFileSync(srcPath, destPath);
          db.update(assets)
            .set({ receipt_path: assetReceiptName, receipt_mime: expense.receipt_mime })
            .where(eq(assets.id, id))
            .run();
        }
      }
    }
  }

  return NextResponse.json({ id, is_low_value: isLowValue }, { status: 201 });
}
