import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listWorkContracts, createWorkContract } from "@/lib/work-contracts";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const contracts = listWorkContracts(session.activeBusiness.id);
  return NextResponse.json(contracts);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const body = await request.json();

  const { client_name, contract_type, start_date, wt_rate } = body;
  if (!client_name || !contract_type || !start_date || wt_rate == null) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const validTypes = ["hourly", "fixed_price", "retainer"];
  if (!validTypes.includes(contract_type)) {
    return NextResponse.json({ error: "Invalid contract type" }, { status: 400 });
  }

  const numericWt = Number(wt_rate);
  if (isNaN(numericWt) || numericWt < 0 || numericWt > 1) {
    return NextResponse.json({ error: "WT rate must be between 0 and 1" }, { status: 400 });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(start_date) || isNaN(Date.parse(start_date))) {
    return NextResponse.json({ error: "Invalid start date format" }, { status: 400 });
  }

  if (body.end_date && (!/^\d{4}-\d{2}-\d{2}$/.test(body.end_date) || isNaN(Date.parse(body.end_date)))) {
    return NextResponse.json({ error: "Invalid end date format" }, { status: 400 });
  }

  const contract = createWorkContract(session.activeBusiness.id, {
    client_name,
    contract_type,
    hourly_rate: body.hourly_rate ?? null,
    weekly_hours: body.weekly_hours ?? null,
    fixed_price: body.fixed_price ?? null,
    retainer_amount: body.retainer_amount ?? null,
    retainer_hours: body.retainer_hours ?? null,
    start_date,
    end_date: body.end_date ?? null,
    wt_rate,
    document_id: body.document_id ?? null,
    notes: body.notes ?? null,
  });

  return NextResponse.json(contract, { status: 201 });
}
