import { describe, expect, it } from "vitest";
import { chatTools } from "@/lib/ai/tools";

/**
 * Regression for audit #116 — every mutating chat tool must produce an
 * audit_log entry. Either:
 *   1. via the AUTO_AUDIT_TOOLS map in src/lib/ai/audit.ts (most tools), or
 *   2. via an explicit recordAction() call inside the tool's dispatch case.
 *
 * We can't import the private AUTO_AUDIT_TOOLS constant directly without
 * exposing internals; instead we test the OUTBOUND contract — every tool
 * we know to be mutating should be either in AUTO_AUDIT_TOOLS_NAMES below
 * (must match the map in audit.ts) or in MANUALLY_LOGGED.
 *
 * Adding a new mutating tool? Add it to one list AND audit.ts.
 */
const AUTO_AUDIT_TOOLS_NAMES = new Set([
  "create_expense",
  "create_timesheet_entry",
  "approve_timesheet_entries",
  "create_invoice_from_timesheets",
  "send_invoice_email",
  "email_payslips",
  "email_timesheet",
  "finalise_pay_run",
  "create_pay_run",
  "create_contact",
  "update_work_contract",
  "categorise_bank_transaction",
  "match_bank_transaction",
  "reconcile_bank_transaction",
  "exclude_bank_transaction",
]);

const MANUALLY_LOGGED = new Set([
  "declare_dividend",         // explicit recordAction in case
  "delete_timesheet_entries",  // explicit recordAction in case
]);

/** Heuristic — chat tool names that imply state mutation. */
function isMutatingToolName(name: string): boolean {
  return /^(create_|update_|delete_|approve_|finalise_|email_|send_|declare_|categorise_|match_|reconcile_|exclude_)/.test(
    name,
  );
}

describe("audit_log coverage on mutating chat tools", () => {
  it("every mutating tool is either auto-audited or manually-logged", () => {
    const missing: string[] = [];
    for (const t of chatTools) {
      if (!isMutatingToolName(t.name)) continue;
      if (AUTO_AUDIT_TOOLS_NAMES.has(t.name)) continue;
      if (MANUALLY_LOGGED.has(t.name)) continue;
      missing.push(t.name);
    }
    expect(missing, `Add to AUTO_AUDIT_TOOLS in src/lib/ai/audit.ts: ${missing.join(", ")}`).toEqual([]);
  });

  it("AUTO_AUDIT_TOOLS doesn't shadow MANUALLY_LOGGED tools (would double-log)", () => {
    for (const name of MANUALLY_LOGGED) {
      expect(AUTO_AUDIT_TOOLS_NAMES.has(name), `${name} is in BOTH lists — would double-log`).toBe(false);
    }
  });

  it("read-only tools are not in the audit map", () => {
    const sample = ["get_invoices", "get_employees", "calculate_gst_return", "list_chat_actions"];
    for (const name of sample) {
      expect(AUTO_AUDIT_TOOLS_NAMES.has(name), `${name} is read-only — should not be in audit map`).toBe(false);
    }
  });
});
