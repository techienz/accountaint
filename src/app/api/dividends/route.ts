import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  declareDividend,
  listDividendDeclarations,
} from "@/lib/dividends";

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
  const { date, total_amount, notes } = body as {
    date?: string;
    total_amount?: number;
    notes?: string;
  };

  if (!total_amount || total_amount <= 0) {
    return NextResponse.json(
      { error: "total_amount must be a positive number" },
      { status: 400 }
    );
  }

  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "date is required in YYYY-MM-DD format" },
      { status: 400 }
    );
  }

  try {
    const result = await declareDividend(business.id, {
      date,
      totalAmount: total_amount,
      notes,
    });
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to declare dividend";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const taxYear = request.nextUrl.searchParams.get("tax_year") ?? undefined;
  const declarations = listDividendDeclarations(business.id, taxYear);
  return NextResponse.json({ declarations });
}
