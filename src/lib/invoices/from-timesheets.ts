import { getDb, schema } from "@/lib/db";
import { eq, and, inArray } from "drizzle-orm";
import { decrypt } from "@/lib/encryption";
import { findOrCreateContactByName } from "@/lib/contacts";
import { createInvoice } from "./index";

type TimesheetInvoiceRequest = {
  work_contract_id: string;
  entry_ids?: string[];
  gst_rate?: number;
  include_descriptions?: boolean;
  include_invoiced?: boolean; // re-invoice already-invoiced entries
};

export async function createInvoiceFromTimesheets(
  businessId: string,
  requests: TimesheetInvoiceRequest[]
) {
  const db = getDb();
  const { todayNZ } = await import("@/lib/utils/dates");
  const today = todayNZ();

  const allLineItems: Array<{
    description: string;
    quantity: number;
    unit_price: number;
    gst_rate: number;
    work_contract_id: string;
  }> = [];

  let contactId: string | null = null;

  for (const req of requests) {
    // Fetch contract
    const contract = db
      .select()
      .from(schema.workContracts)
      .where(
        and(
          eq(schema.workContracts.id, req.work_contract_id),
          eq(schema.workContracts.business_id, businessId)
        )
      )
      .get();
    if (!contract) throw new Error(`Work contract not found: ${req.work_contract_id}`);

    const clientName = decrypt(contract.client_name);

    // Find or create a contact for this client
    const contact = findOrCreateContactByName(businessId, clientName, "customer");
    if (!contact) throw new Error(`Failed to create contact for ${clientName}`);

    // All requests must map to the same contact for a single invoice
    if (contactId && contactId !== contact.id) {
      throw new Error("All timesheet requests must be for the same client");
    }
    contactId = contact.id;

    // Fetch entries for this contract
    const baseConditions = [
      eq(schema.timesheetEntries.business_id, businessId),
      eq(schema.timesheetEntries.work_contract_id, req.work_contract_id),
    ];

    // Get approved entries
    let entries = db
      .select()
      .from(schema.timesheetEntries)
      .where(and(...baseConditions, eq(schema.timesheetEntries.status, "approved")))
      .all();

    // If include_invoiced, also grab invoiced entries and revert them
    if (req.include_invoiced && entries.length === 0) {
      const invoicedEntries = db
        .select()
        .from(schema.timesheetEntries)
        .where(and(...baseConditions, eq(schema.timesheetEntries.status, "invoiced")))
        .all();

      if (invoicedEntries.length > 0) {
        // Revert to approved
        for (const entry of invoicedEntries) {
          db.update(schema.timesheetEntries)
            .set({ status: "approved", invoice_id: null })
            .where(eq(schema.timesheetEntries.id, entry.id))
            .run();
        }
        entries = invoicedEntries;
      }
    }

    // Filter by specific IDs if provided
    if (req.entry_ids && req.entry_ids.length > 0) {
      const idSet = new Set(req.entry_ids);
      entries = entries.filter((e) => idSet.has(e.id));
    }

    if (entries.length === 0) {
      throw new Error(`No approved timesheet entries for contract: ${clientName}. If entries are already invoiced, ask to regenerate the invoice.`);
    }

    // Calculate total hours
    const totalMinutes = entries.reduce((sum, e) => sum + e.duration_minutes, 0);
    const totalHours = Math.round((totalMinutes / 60) * 100) / 100;

    // Date range for description
    const dates = entries.map((e) => e.date).sort();
    const dateRange =
      dates.length === 1
        ? dates[0]
        : `${dates[0]} to ${dates[dates.length - 1]}`;

    const hourlyRate = entries[0].hourly_rate ?? contract.hourly_rate ?? 0;

    if (req.include_descriptions) {
      // One line item per timesheet entry with its description
      for (const entry of entries) {
        const hours = Math.round((entry.duration_minutes / 60) * 100) / 100;
        const desc = entry.description
          ? `${entry.date}: ${decrypt(entry.description)}`
          : `${entry.date}: ${clientName} — ${hours}hrs`;
        allLineItems.push({
          description: desc,
          quantity: hours,
          unit_price: entry.hourly_rate ?? hourlyRate,
          gst_rate: req.gst_rate ?? 0.15,
          work_contract_id: req.work_contract_id,
        });
      }
    } else {
      // Single summary line item
      allLineItems.push({
        description: `${clientName} — ${totalHours}hrs (${dateRange})`,
        quantity: totalHours,
        unit_price: hourlyRate,
        gst_rate: req.gst_rate ?? 0.15,
        work_contract_id: req.work_contract_id,
      });
    }

    // Mark entries as invoiced (we'll set invoice_id after creation)
    for (const entry of entries) {
      db.update(schema.timesheetEntries)
        .set({ status: "invoiced", updated_at: new Date() })
        .where(eq(schema.timesheetEntries.id, entry.id))
        .run();
    }
  }

  if (!contactId) throw new Error("No valid timesheet requests");

  // Get contact's default due days
  const contact = db
    .select()
    .from(schema.contacts)
    .where(eq(schema.contacts.id, contactId))
    .get();

  const dueDays = contact?.default_due_days ?? 20;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

  // Get default payment instructions from business
  const biz = db
    .select()
    .from(schema.businesses)
    .where(eq(schema.businesses.id, businessId))
    .get();

  const invoice = createInvoice(businessId, {
    contact_id: contactId,
    type: "ACCREC",
    date: today,
    due_date: `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, "0")}-${String(dueDate.getDate()).padStart(2, "0")}`,
    gst_inclusive: false,
    payment_instructions: biz?.payment_instructions ?? null,
    line_items: allLineItems,
  });

  // Update timesheet entries with invoice_id
  if (invoice) {
    for (const req of requests) {
      const conditions = [
        eq(schema.timesheetEntries.business_id, businessId),
        eq(schema.timesheetEntries.work_contract_id, req.work_contract_id),
        eq(schema.timesheetEntries.status, "invoiced"),
      ];

      // Only update entries that don't already have an invoice_id
      db.update(schema.timesheetEntries)
        .set({ invoice_id: invoice.id })
        .where(and(...conditions))
        .run();
    }
  }

  return invoice;
}
