import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

const RESULT_SUMMARY_MAX_CHARS = 500;

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
