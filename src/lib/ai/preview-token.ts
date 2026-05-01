import crypto from "node:crypto";
import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

const TOKEN_TTL_MINUTES = 5;

/**
 * Canonicalise tool args into a stable string for hashing. Object keys
 * sorted; null/undefined dropped from comparison-relevant set; numbers
 * coerced to strings. Goal: same args → same hash regardless of key order
 * or trivial JSON formatting differences.
 */
function canonicalArgs(args: unknown): string {
  if (args === null || args === undefined) return "";
  if (typeof args !== "object") return JSON.stringify(args);
  const obj = args as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => k !== "preview_token" && k !== "confirm" && obj[k] !== undefined)
    .sort();
  const sorted: Record<string, unknown> = {};
  for (const k of keys) sorted[k] = obj[k];
  return JSON.stringify(sorted);
}

function hashArgs(args: unknown): string {
  return crypto.createHash("sha256").update(canonicalArgs(args)).digest("hex");
}

export type PreviewTokenIssue = {
  businessId: string;
  userId: string;
  toolName: string;
  args: unknown;
};

/**
 * Create a preview-step token. Returns the token id (which IS the token
 * value — opaque random uuid). Caller embeds in the preview response so
 * the AI / client can pass it to the execute step.
 */
export function issuePreviewToken(input: PreviewTokenIssue): string {
  const db = getDb();
  const id = uuid();
  const now = new Date();
  const expires = new Date(now.getTime() + TOKEN_TTL_MINUTES * 60_000);

  db.insert(schema.previewTokens).values({
    id,
    business_id: input.businessId,
    user_id: input.userId,
    tool_name: input.toolName,
    args_hash: hashArgs(input.args),
    created_at: now,
    expires_at: expires,
  }).run();

  return id;
}

export type ConsumeResult =
  | { ok: true }
  | { ok: false; reason: "missing" | "wrong_business" | "wrong_tool" | "args_changed" | "expired" | "already_used" };

/**
 * Verify and atomically consume a preview token. Returns ok:true exactly
 * once per token; subsequent calls fail with already_used. Errors include
 * a reason for diagnostics.
 */
export function consumePreviewToken(input: {
  token: string;
  businessId: string;
  toolName: string;
  args: unknown;
}): ConsumeResult {
  const db = getDb();
  const row = db
    .select()
    .from(schema.previewTokens)
    .where(eq(schema.previewTokens.id, input.token))
    .get();

  if (!row) return { ok: false, reason: "missing" };
  if (row.business_id !== input.businessId) return { ok: false, reason: "wrong_business" };
  if (row.tool_name !== input.toolName) return { ok: false, reason: "wrong_tool" };
  if (row.used_at !== null) return { ok: false, reason: "already_used" };
  if (row.expires_at.getTime() < Date.now()) return { ok: false, reason: "expired" };
  if (row.args_hash !== hashArgs(input.args)) return { ok: false, reason: "args_changed" };

  // Atomic claim: only succeed if used_at is still null
  const result = db
    .update(schema.previewTokens)
    .set({ used_at: new Date() })
    .where(and(eq(schema.previewTokens.id, input.token), eq(schema.previewTokens.used_at, null as unknown as Date)))
    .run();

  if (result.changes === 0) return { ok: false, reason: "already_used" };
  return { ok: true };
}
