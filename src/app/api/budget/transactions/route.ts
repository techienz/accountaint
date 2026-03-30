import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listTransactions } from "@/lib/budget/transactions";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const transactions = listTransactions(session.user.id, {
    bankAccountId: searchParams.get("account") ?? undefined,
    categoryId: searchParams.has("category")
      ? searchParams.get("category") || null
      : undefined,
    startDate: searchParams.get("start") ?? undefined,
    endDate: searchParams.get("end") ?? undefined,
    uncategorisedOnly: searchParams.get("uncategorised") === "true",
  });

  return NextResponse.json(transactions);
}
