import { revalidatePath } from "next/cache";

/**
 * Invalidate Next.js Server-Component caches for every page that
 * displays invoice-derived data. Call this after any mutation that
 * could change what /invoices, /, /reports/*, /snapshot, /tax-prep/*,
 * etc. show — without it, those pages render stale state until the
 * user manually navigates away and back.
 *
 * Affected mutations: create, edit, send (status flip + journal post),
 * void (status flip + journal reversal), delete (cascade), record/delete
 * payment (amount_due updates).
 *
 * The "layout" mode invalidates everything under the root layout —
 * cheaper than enumerating each path individually and safer because
 * adding a new dashboard widget that consumes invoice data won't
 * silently miss revalidation.
 */
export function revalidateInvoiceViews(): void {
  revalidatePath("/", "layout");
}
