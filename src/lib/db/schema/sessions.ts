import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { users } from "./users";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(), // UUID
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  token_hash: text("token_hash").notNull(),
  expires_at: integer("expires_at", { mode: "timestamp" }).notNull(),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
