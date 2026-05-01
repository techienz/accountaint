import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";

/**
 * Server-issued tokens that bind a "preview" tool call to its later
 * "execute" call. Without this, an AI calling `tool({ confirm: true })` on
 * the FIRST turn skips the preview entirely. The pattern:
 *
 *   1. Client calls tool with no preview_token → tool returns preview + token
 *   2. Token row inserted (business + user + tool name + args hash)
 *   3. Client (after user approval) calls tool with preview_token
 *   4. Tool verifies token: exists, not used, not expired, args_hash still
 *      matches the current args (so AI can't sneak modifications between
 *      the preview the user saw and the call they actually approved)
 *   5. Mark used, execute
 *
 * Audit finding #66 (2026-05-01).
 */
export const previewTokens = sqliteTable("preview_tokens", {
  id: text("id").primaryKey(),                              // also used as the token value
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  user_id: text("user_id"),                                 // who issued the preview
  tool_name: text("tool_name").notNull(),
  args_hash: text("args_hash").notNull(),                   // SHA-256 of canonical args
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  expires_at: integer("expires_at", { mode: "timestamp" }).notNull(),
  used_at: integer("used_at", { mode: "timestamp" }),       // null until consumed
});
