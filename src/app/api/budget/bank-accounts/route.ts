import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listBankAccounts, createBankAccount } from "@/lib/budget";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json(listBankAccounts(session.user.id));
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  if (!body.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const account = createBankAccount(session.user.id, {
    name: body.name,
    institution: body.institution ?? null,
    account_type: body.account_type ?? "everyday",
    balance: body.balance ?? 0,
    notes: body.notes ?? null,
  });
  return NextResponse.json(account, { status: 201 });
}
