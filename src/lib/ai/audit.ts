import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { recordAction } from "@/lib/audit/actions";

const RESULT_SUMMARY_MAX_CHARS = 500;

/**
 * Mutating chat tools that should also write a row to the cross-cutting
 * `audit_log` (in addition to the per-call `chat_actions` log). The map
 * binds tool name → { entityType, action } so /audit/actions surfaces
 * chat-originated mutations alongside UI mutations. Audit 2026-05-02 #116.
 *
 * Tools NOT in this map either:
 *  - are read-only (get_*, list_*, calculate_*, suggest_*, analyse_*); or
 *  - already call recordAction() explicitly with richer before/after data
 *    (declare_dividend, delete_timesheet_entries — see their cases).
 *
 * When adding a new mutating tool, add it here so the unified audit
 * trail stays complete.
 */
const AUTO_AUDIT_TOOLS: Record<string, { entityType: string; action: string }> = {
  create_expense: { entityType: "expense", action: "created" },
  create_timesheet_entry: { entityType: "timesheet_entry", action: "created" },
  approve_timesheet_entries: { entityType: "timesheet_entry", action: "approved" },
  create_invoice_from_timesheets: { entityType: "invoice", action: "created" },
  send_invoice_email: { entityType: "invoice", action: "emailed" },
  email_payslips: { entityType: "pay_run", action: "emailed" },
  email_timesheet: { entityType: "timesheet", action: "emailed" },
  finalise_pay_run: { entityType: "pay_run", action: "finalised" },
  create_pay_run: { entityType: "pay_run", action: "created" },
  create_contact: { entityType: "contact", action: "created" },
  update_work_contract: { entityType: "work_contract", action: "updated" },
  categorise_bank_transaction: { entityType: "bank_transaction", action: "categorised" },
  match_bank_transaction: { entityType: "bank_transaction", action: "matched" },
  reconcile_bank_transaction: { entityType: "bank_transaction", action: "reconciled" },
  exclude_bank_transaction: { entityType: "bank_transaction", action: "excluded" },
};

/** Best-effort extraction of an entity id from a tool result. Returns null
 *  when none can be found — audit_log accepts null entity_id. */
function extractEntityId(toolName: string, result: unknown): string | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;

  // Direct id on the root
  if (typeof r.id === "string") return r.id;

  // Common per-tool shapes
  switch (toolName) {
    case "create_expense":
      return (r.expense as { id?: string })?.id ?? null;
    case "create_timesheet_entry":
      return (r.entry as { id?: string })?.id ?? null;
    case "create_contact":
      return (r.contact as { id?: string })?.id ?? null;
    case "send_invoice_email":
      return (toolName in r) ? null : null; // invoice_id lives in args, handled below
    case "finalise_pay_run":
    case "email_payslips":
      return null; // pay_run_id is in args, not result
    case "categorise_bank_transaction":
    case "match_bank_transaction":
    case "reconcile_bank_transaction":
    case "exclude_bank_transaction":
      return null; // bank_transaction_id is in args
    default:
      return null;
  }
}

/** Prefer args fields when the result doesn't carry the id. */
function entityIdFromArgs(toolName: string, args: unknown): string | null {
  if (!args || typeof args !== "object") return null;
  const a = args as Record<string, unknown>;
  switch (toolName) {
    case "send_invoice_email":
    case "create_invoice_from_timesheets":
      return (a.invoice_id as string | undefined) ?? null;
    case "finalise_pay_run":
    case "email_payslips":
      return (a.pay_run_id as string | undefined) ?? null;
    case "email_timesheet":
      return (a.contract_id as string | undefined) ?? null;
    case "approve_timesheet_entries": {
      const ids = a.entry_ids as string[] | undefined;
      return ids && ids.length === 1 ? ids[0] : null; // multiple → null, summary captures count
    }
    case "categorise_bank_transaction":
    case "match_bank_transaction":
    case "reconcile_bank_transaction":
    case "exclude_bank_transaction":
      return (a.bank_transaction_id as string | undefined) ?? null;
    case "update_work_contract":
      return (a.contract_id as string | undefined) ?? null;
    default:
      return null;
  }
}

/** Returns true if the chat-tool result is a preview (no mutation happened). */
function isPreviewResult(result: unknown): boolean {
  return typeof result === "object" && result !== null && (result as { preview?: unknown }).preview === true;
}

/**
 * Wrap a tool call so we record args, result/error, and timing. Never throws —
 * if logging fails (e.g., table missing) we still return the underlying tool
 * result. Logging failures must not break the chat.
 */
export async function recordChatAction<T>(opts: {
  businessId: string;
  userId: string;
  conversationId: string;
  toolName: string;
  args: unknown;
  fn: () => Promise<T>;
}): Promise<T> {
  const { businessId, userId, conversationId, toolName, args, fn } = opts;
  const db = getDb();
  const id = uuid();
  const start = Date.now();

  let result: T | undefined;
  let error: Error | undefined;
  try {
    result = await fn();
  } catch (err) {
    error = err instanceof Error ? err : new Error(String(err));
  }

  try {
    let resultSummary: string | null = null;
    if (!error) {
      try {
        const stringified = JSON.stringify(result);
        resultSummary = stringified.length > RESULT_SUMMARY_MAX_CHARS
          ? stringified.slice(0, RESULT_SUMMARY_MAX_CHARS) + "…"
          : stringified;
      } catch {
        resultSummary = "(unserializable)";
      }
    }

    db.insert(schema.chatActions).values({
      id,
      business_id: businessId,
      user_id: userId,
      conversation_id: conversationId,
      tool_name: toolName,
      args_json: safeStringify(args),
      result_summary: resultSummary,
      success: !error,
      error_message: error ? error.message.slice(0, 4000) : null,
      duration_ms: Date.now() - start,
    }).run();
  } catch (logErr) {
    console.error(`[chat-audit] Failed to record action ${toolName}:`, logErr);
  }

  // Cross-cutting audit_log write (audit #116). Only on successful, non-
  // preview results, and only for tools in AUTO_AUDIT_TOOLS — read-only
  // tools shouldn't write, and tools that handle audit_log themselves
  // (declare_dividend, delete_timesheet_entries) are intentionally absent
  // so they don't double-log.
  if (!error && !isPreviewResult(result)) {
    const mapping = AUTO_AUDIT_TOOLS[toolName];
    if (mapping) {
      const entityId = extractEntityId(toolName, result) ?? entityIdFromArgs(toolName, args);
      recordAction({
        businessId,
        userId,
        source: "chat",
        entityType: mapping.entityType,
        entityId,
        action: mapping.action,
        summary: `via chat: ${toolName}`,
        after: result,
      });
    }
  }

  if (error) throw error;
  return result as T;
}

function safeStringify(v: unknown): string | null {
  try {
    const s = JSON.stringify(v);
    return s.length > 4000 ? s.slice(0, 4000) + "…" : s;
  } catch {
    return null;
  }
}

export function listChatActions(businessId: string, limit = 100, opts?: { toolName?: string; success?: boolean }) {
  const db = getDb();
  const all = db
    .select()
    .from(schema.chatActions)
    .where(eq(schema.chatActions.business_id, businessId))
    .orderBy(desc(schema.chatActions.created_at))
    .limit(500)
    .all();
  let filtered = all;
  if (opts?.toolName) filtered = filtered.filter((r) => r.tool_name === opts.toolName);
  if (opts?.success !== undefined) filtered = filtered.filter((r) => r.success === opts.success);
  return filtered.slice(0, limit);
}
