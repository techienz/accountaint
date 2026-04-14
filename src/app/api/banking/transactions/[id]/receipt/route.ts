import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import fs from "fs";
import path from "path";
import { createDocumentFromUpload } from "@/lib/documents/upload";

const RECEIPTS_DIR = "data/receipts";
const DOCS_DIR = "data/documents";

/**
 * GET: Serve the receipt file for a bank transaction.
 */
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

  const txn = db
    .select()
    .from(schema.bankTransactions)
    .where(
      and(
        eq(schema.bankTransactions.id, id),
        eq(schema.bankTransactions.business_id, businessId)
      )
    )
    .get();

  if (!txn?.receipt_path) {
    return NextResponse.json({ error: "No receipt" }, { status: 404 });
  }

  // Try document vault first, then legacy receipts dir
  let filePath = path.join(process.cwd(), DOCS_DIR, businessId, txn.receipt_path);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(process.cwd(), RECEIPTS_DIR, businessId, txn.receipt_path);
  }
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": txn.receipt_mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${txn.receipt_path}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}

/**
 * POST: Upload a receipt for a bank transaction.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const businessId = session.activeBusiness.id;
  const db = getDb();

  const txn = db
    .select()
    .from(schema.bankTransactions)
    .where(
      and(
        eq(schema.bankTransactions.id, id),
        eq(schema.bankTransactions.business_id, businessId)
      )
    )
    .get();

  if (!txn) {
    return NextResponse.json({ error: "Transaction not found" }, { status: 404 });
  }

  const formData = await request.formData();
  const file = formData.get("receipt") as File | null;
  if (!file || file.size === 0) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Save via unified document vault
  const doc = createDocumentFromUpload(businessId, {
    name: file.name,
    type: file.type,
    buffer,
  }, {
    folderName: "Bank Receipts",
    documentType: "bank_receipt",
    linkedEntityType: "bank_transaction",
    linkedEntityId: id,
  });

  // Update transaction with both legacy path and new document reference
  db.update(schema.bankTransactions)
    .set({
      receipt_path: doc.filePath,
      receipt_mime: file.type,
      receipt_document_id: doc.id,
    })
    .where(eq(schema.bankTransactions.id, id))
    .run();

  return NextResponse.json({ success: true, documentId: doc.id });
}

/**
 * DELETE: Remove a receipt from a bank transaction.
 */
export async function DELETE(
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

  const txn = db
    .select()
    .from(schema.bankTransactions)
    .where(
      and(
        eq(schema.bankTransactions.id, id),
        eq(schema.bankTransactions.business_id, businessId)
      )
    )
    .get();

  if (txn?.receipt_path) {
    const filePath = path.join(process.cwd(), RECEIPTS_DIR, businessId, txn.receipt_path);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    db.update(schema.bankTransactions)
      .set({ receipt_path: null, receipt_mime: null })
      .where(eq(schema.bankTransactions.id, id))
      .run();
  }

  return NextResponse.json({ success: true });
}
