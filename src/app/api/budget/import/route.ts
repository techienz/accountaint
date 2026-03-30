import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { parseSpreadsheet, importBudgetFromExcel } from "@/lib/budget/import";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const preview = formData.get("preview");

    if (preview === "true") {
      const parsed = parseSpreadsheet(buffer);
      return NextResponse.json({ preview: true, data: parsed });
    }

    const result = importBudgetFromExcel(session.user.id, buffer);
    return NextResponse.json({
      success: true,
      counts: result.counts,
    });
  }

  return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
}
