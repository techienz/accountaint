import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listContacts, createContact } from "@/lib/contacts";

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type") as "customer" | "supplier" | "both" | null;

  const contacts = listContacts(
    session.activeBusiness.id,
    type ? { type } : undefined
  );
  return NextResponse.json(contacts);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const body = await request.json();

  if (!body.name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const validTypes = ["customer", "supplier", "both"];
  if (body.type && !validTypes.includes(body.type)) {
    return NextResponse.json({ error: "Invalid contact type" }, { status: 400 });
  }

  const contact = createContact(session.activeBusiness.id, {
    name: body.name,
    email: body.email ?? null,
    phone: body.phone ?? null,
    address: body.address ?? null,
    tax_number: body.tax_number ?? null,
    type: body.type ?? "customer",
    default_due_days: body.default_due_days ?? 20,
    notes: body.notes ?? null,
  });

  return NextResponse.json(contact, { status: 201 });
}
