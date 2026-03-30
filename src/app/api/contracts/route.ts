import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listContracts, createContract } from "@/lib/contracts";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const contracts = listContracts(session.activeBusiness.id);
  return NextResponse.json(contracts);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const body = await request.json();

  const { provider, service_name, category, cost, billing_cycle, start_date, term_months, auto_renew, notes } = body;
  if (!provider || !service_name || !category || cost == null || !billing_cycle || !start_date) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const contract = createContract(session.activeBusiness.id, {
    provider,
    service_name,
    category,
    cost,
    billing_cycle,
    start_date,
    term_months: term_months ?? null,
    auto_renew: auto_renew ?? false,
    notes: notes ?? null,
  });

  return NextResponse.json(contract, { status: 201 });
}
