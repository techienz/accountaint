import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listExpenses, createExpense, updateExpense, saveReceiptFile } from "@/lib/expenses";
import { extractReceiptData } from "@/lib/expenses/ocr";

type ExpenseCategory = "office_supplies" | "travel" | "meals_entertainment" | "professional_fees" | "software_subscriptions" | "vehicle" | "home_office" | "utilities" | "insurance" | "bank_fees" | "other";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const url = new URL(request.url);
  const category = url.searchParams.get("category") || undefined;
  const dateFrom = url.searchParams.get("dateFrom") || undefined;
  const dateTo = url.searchParams.get("dateTo") || undefined;

  const expenses = listExpenses(session.activeBusiness.id, { category, dateFrom, dateTo });
  return NextResponse.json(expenses);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const businessId = session.activeBusiness.id;
  const contentType = request.headers.get("content-type") || "";

  // Handle multipart form data (with receipt)
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const receipt = formData.get("receipt") as File | null;

    let ocrRaw: string | null = null;
    let ocrResult: Record<string, unknown> | null = null;
    let receiptBuffer: Buffer | null = null;
    let receiptExt = "jpg";
    let receiptMime: string | null = null;

    if (receipt && receipt.size > 0) {
      receiptBuffer = Buffer.from(await receipt.arrayBuffer());
      receiptExt = receipt.name.split(".").pop() || "jpg";
      receiptMime = receipt.type;

      // Try OCR if it's an image
      if (receipt.type.startsWith("image/")) {
        const extracted = await extractReceiptData(receiptBuffer, receipt.type);
        if (extracted) {
          ocrRaw = JSON.stringify(extracted);
          ocrResult = extracted as unknown as Record<string, unknown>;
        }
      }
    }

    const vendor = (formData.get("vendor") as string) || (ocrResult?.vendor as string) || "Unknown";
    const amount = formData.get("amount")
      ? Number(formData.get("amount"))
      : (ocrResult?.amount as number) || 0;
    const date = (formData.get("date") as string)
      || (ocrResult?.date as string)
      || new Date().toISOString().slice(0, 10);
    const category = (formData.get("category") as string)
      || (ocrResult?.category as string)
      || "other";
    const gstAmount = formData.get("gst_amount")
      ? Number(formData.get("gst_amount"))
      : (ocrResult?.gst_amount as number) || null;

    const isReceiptOnly = !formData.get("vendor") && !formData.get("amount") && ocrResult;

    // Create the expense first (without receipt path)
    const expense = await createExpense(businessId, {
      vendor,
      description: (formData.get("description") as string) || null,
      amount,
      gst_amount: gstAmount,
      category: category as ExpenseCategory,
      date,
      receipt_mime: receiptMime,
      ocr_raw: ocrRaw,
      status: isReceiptOnly ? "draft" : "confirmed",
    });

    // Now save the receipt file with the real expense ID
    if (receiptBuffer && expense) {
      const receiptPath = saveReceiptFile(businessId, expense.id, receiptBuffer, receiptExt);
      updateExpense(expense.id, businessId, { receipt_path: receiptPath });
      expense.receipt_path = receiptPath;
    }

    return NextResponse.json({ ...expense, ocr: ocrResult }, { status: 201 });
  }

  // Handle JSON body (manual entry)
  const body = await request.json();
  const { vendor, description, amount, gst_amount, category, date, status } = body;

  if (!vendor || amount == null || !category || !date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const expense = await createExpense(businessId, {
    vendor,
    description: description || null,
    amount,
    gst_amount: gst_amount ?? null,
    category,
    date,
    status: status || "confirmed",
  });

  return NextResponse.json(expense, { status: 201 });
}
