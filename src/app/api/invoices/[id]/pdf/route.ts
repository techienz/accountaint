import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getInvoice } from "@/lib/invoices";
import { generateInvoicePdf } from "@/lib/invoices/pdf";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getContact } from "@/lib/contacts";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const businessId = session.activeBusiness.id;
  const invoice = getInvoice(id, businessId);
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const db = getDb();
  const business = db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, businessId))
    .get();
  if (!business) return NextResponse.json({ error: "Business not found" }, { status: 404 });

  const contact = getContact(invoice.contact_id, businessId);
  if (!contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });

  const pdfBuffer = await generateInvoicePdf(invoice, business, contact);

  return new NextResponse(new Uint8Array(pdfBuffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
    },
  });
}
