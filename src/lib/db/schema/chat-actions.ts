import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

/**
 * Audit log of every chat tool call. One row per tool invocation, written
 * around the dispatch in claude.ts. Surfaces on /audit/chat. The point is to
 * make AI behaviour reviewable retroactively — hallucinations and bad tool
 * calls become visible after the fact instead of only when the user notices.
 */
export const chatActions = sqliteTable("chat_actions", {
  id: text("id").primaryKey(),
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  user_id: text("user_id"),                 // who was chatting (no FK — keep audit even if user deleted)
  conversation_id: text("conversation_id").notNull(), // shared by all tool calls within one streamChat invocation
  tool_name: text("tool_name").notNull(),
  args_json: text("args_json"),             // JSON-encoded input
  result_summary: text("result_summary"),   // first ~500 chars of stringified result
  success: integer("success", { mode: "boolean" }).notNull().default(true),
  error_message: text("error_message"),
  duration_ms: integer("duration_ms"),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
