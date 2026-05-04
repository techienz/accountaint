import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { linkTimesheetEntriesToInvoice } from "@/lib/timesheets";
import { recordAction } from "@/lib/audit/actions";
import { revalidateInvoiceViews } from "@/lib/invoices/revalidate";
import { getDb, schema } from "@/lib/db";
import { and, eq } from "drizzle-orm";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const entryIds = Array.isArray(body?.entry_ids) ? body.entry_ids.filter((x: unknown): x is string => typeof x === "string") : null;

  if (!entryIds || entryIds.length === 0) {
    return NextResponse.json({ error: "entry_ids must be a non-empty array of strings" }, { status: 400 });
  }

  const result = linkTimesheetEntriesToInvoice(
    session.activeBusiness.id,
    id,
    entryIds
  );

  if (!result.ok) {
    const status =
      result.reason === "invoice_not_found" ? 404 :
      result.reason === "invoice_voided" ? 409 :
      400;
    const errorMessages: Record<string, string> = {
      invoice_not_found: "Invoice not found",
      invoice_voided: "Cannot link entries to a voided invoice",
      no_entries_provided: "Provide at least one entry id",
      entries_invalid: "Some entries are not approved+billable+unlinked. Re-check the picker.",
    };
    return NextResponse.json(
      { error: errorMessages[result.reason], reason: result.reason, invalidIds: result.reason === "entries_invalid" ? result.invalidIds : undefined },
      { status },
    );
  }

  // Fetch invoice number for the audit summary
  const db = getDb();
  const invoice = db
    .select({ invoice_number: schema.invoices.invoice_number })
    .from(schema.invoices)
    .where(
      and(
        eq(schema.invoices.id, id),
        eq(schema.invoices.business_id, session.activeBusiness.id)
      )
    )
    .get();

  recordAction({
    businessId: session.activeBusiness.id,
    userId: session.user.id,
    source: "ui",
    entityType: "invoice",
    entityId: id,
    action: "timesheets_linked",
    summary: `Linked ${result.linkedCount} timesheet ${result.linkedCount === 1 ? "entry" : "entries"} to invoice ${invoice?.invoice_number ?? id}`,
    after: { entry_ids: result.entryIds, count: result.linkedCount },
  });

  revalidateInvoiceViews();

  return NextResponse.json({ ok: true, linkedCount: result.linkedCount });
}
