import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getExpense, getReceiptFilePath } from "@/lib/expenses";
import * as fs from "fs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const expense = getExpense(id, session.activeBusiness.id);
  if (!expense || !expense.receipt_path) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const filePath = getReceiptFilePath(session.activeBusiness.id, expense.receipt_path);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Receipt file not found" }, { status: 404 });
  }

  const buffer = fs.readFileSync(filePath);
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": expense.receipt_mime || "application/octet-stream",
      "Content-Disposition": `inline; filename="${expense.receipt_path}"`,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
