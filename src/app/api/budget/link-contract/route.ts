import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  createIncome,
  updateIncome,
  getIncomeByContractId,
} from "@/lib/budget";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contract_id");
  if (!contractId) {
    return NextResponse.json({ error: "contract_id required" }, { status: 400 });
  }

  const income = getIncomeByContractId(session.user.id, contractId);
  return NextResponse.json({ linked: income !== null, income });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { label, monthly_amount, work_contract_id } = body;

  if (!label || monthly_amount == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const userId = session.user.id;

  // Check if an income linked to this contract already exists
  if (work_contract_id) {
    const existing = getIncomeByContractId(userId, work_contract_id);
    if (existing) {
      const updated = updateIncome(existing.id, userId, {
        label,
        monthly_amount,
        is_active: true,
      });
      return NextResponse.json({ income: updated, action: "updated" });
    }
  }

  // Create new income linked to the contract
  const income = createIncome(userId, {
    label,
    monthly_amount,
    work_contract_id: work_contract_id ?? null,
  });
  return NextResponse.json({ income, action: "created" }, { status: 201 });
}

// Unlink a contract from budget income
export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contract_id");
  if (!contractId) {
    return NextResponse.json({ error: "contract_id required" }, { status: 400 });
  }

  const userId = session.user.id;
  const existing = getIncomeByContractId(userId, contractId);
  if (!existing) {
    return NextResponse.json({ error: "No linked income found" }, { status: 404 });
  }

  updateIncome(existing.id, userId, { work_contract_id: null });
  return NextResponse.json({ success: true });
}
