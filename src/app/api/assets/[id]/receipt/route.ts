import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

const RECEIPTS_DIR = "data/receipts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const businessId = session.activeBusiness.id;

  const db = getDb();
  const asset = db
    .select()
    .from(schema.assets)
    .where(
      and(
        eq(schema.assets.id, id),
        eq(schema.assets.business_id, businessId)
      )
    )
    .get();

  if (!asset?.receipt_path) {
    return NextResponse.json({ error: "No receipt" }, { status: 404 });
  }

  const filePath = path.join(
    process.cwd(),
    RECEIPTS_DIR,
    businessId,
    asset.receipt_path
  );

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": asset.receipt_mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${asset.receipt_path}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
