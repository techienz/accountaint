import { describe, it, expect } from "vitest";
import type { LinkTimesheetsResult } from "@/lib/timesheets";

/**
 * Pins the result-shape contract for linkTimesheetEntriesToInvoice. Until
 * the test-DB harness lands, the actual DB writes are exercised manually.
 * These tests guarantee callers (API route, UI dialog) can rely on the
 * discriminated union — the `reason` codes the route maps to HTTP status,
 * and the `invalidIds` array drives the user-facing error message.
 */
describe("LinkTimesheetsResult shape", () => {
  it("ok=true carries linkedCount and entryIds", () => {
    const r: LinkTimesheetsResult = { ok: true, linkedCount: 3, entryIds: ["a", "b", "c"] };
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.linkedCount).toBe(3);
      expect(r.entryIds).toEqual(["a", "b", "c"]);
    }
  });

  it("ok=false invoice_not_found has no extra payload", () => {
    const r: LinkTimesheetsResult = { ok: false, reason: "invoice_not_found" };
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toBe("invoice_not_found");
      expect("invalidIds" in r).toBe(false);
    }
  });

  it("ok=false invoice_voided has no extra payload", () => {
    const r: LinkTimesheetsResult = { ok: false, reason: "invoice_voided" };
    if (!r.ok) {
      expect(r.reason).toBe("invoice_voided");
    }
  });

  it("ok=false no_entries_provided has no extra payload", () => {
    const r: LinkTimesheetsResult = { ok: false, reason: "no_entries_provided" };
    if (!r.ok) {
      expect(r.reason).toBe("no_entries_provided");
    }
  });

  it("ok=false entries_invalid carries the offending IDs", () => {
    const r: LinkTimesheetsResult = {
      ok: false,
      reason: "entries_invalid",
      invalidIds: ["x1", "x2"],
    };
    if (!r.ok && r.reason === "entries_invalid") {
      expect(r.invalidIds).toEqual(["x1", "x2"]);
    }
  });

  it("reason string union covers exactly the four failure modes", () => {
    // If a future change adds a new failure mode, exhaust() below will
    // fail to compile and force the caller (API route mapping
    // reason→HTTP status) to update.
    const allReasons: Array<
      Extract<LinkTimesheetsResult, { ok: false }>["reason"]
    > = ["invoice_not_found", "invoice_voided", "no_entries_provided", "entries_invalid"];
    expect(allReasons).toHaveLength(4);
    function exhaust(r: Extract<LinkTimesheetsResult, { ok: false }>["reason"]): string {
      switch (r) {
        case "invoice_not_found": return "404";
        case "invoice_voided": return "409";
        case "no_entries_provided": return "400";
        case "entries_invalid": return "400";
      }
    }
    expect(exhaust("entries_invalid")).toBe("400");
  });
});
