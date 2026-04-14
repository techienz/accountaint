import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getCompanyDetail, isNzbnConfigured } from "@/lib/nzbn/client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ nzbn: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isNzbnConfigured()) {
    return NextResponse.json({ error: "NZBN API key not configured" }, { status: 503 });
  }

  const { nzbn } = await params;
  const company = await getCompanyDetail(nzbn);

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  return NextResponse.json(company);
}
