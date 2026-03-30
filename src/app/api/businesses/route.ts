import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { createBusiness, listBusinesses } from "@/lib/business";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businesses = listBusinesses(session.user.id);
  return NextResponse.json({ businesses });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  if (!body.name || !body.entity_type) {
    return NextResponse.json(
      { error: "Name and entity type are required" },
      { status: 400 }
    );
  }

  const validTypes = ["company", "sole_trader", "partnership", "trust"];
  if (!validTypes.includes(body.entity_type)) {
    return NextResponse.json(
      { error: "Invalid entity type" },
      { status: 400 }
    );
  }

  const business = createBusiness(session.user.id, body);
  return NextResponse.json({ business }, { status: 201 });
}
