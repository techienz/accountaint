import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getContact, updateContact, deleteContact } from "@/lib/contacts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const contact = getContact(id, session.activeBusiness.id);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(contact);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const body = await request.json();
  const contact = updateContact(id, session.activeBusiness.id, body);
  if (!contact) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(contact);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  try {
    const result = deleteContact(id, session.activeBusiness.id);
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Cannot delete contact with existing invoices" },
      { status: 409 }
    );
  }
}
