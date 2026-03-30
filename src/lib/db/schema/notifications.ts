import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { businesses } from "./businesses";
import { users } from "./users";

export const notificationPreferences = sqliteTable("notification_preferences", {
  id: text("id").primaryKey(), // UUID
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  channel: text("channel", {
    enum: ["email", "desktop", "slack", "in_app"],
  }).notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  detail_level: text("detail_level", {
    enum: ["vague", "detailed"],
  })
    .notNull()
    .default("vague"),
  config: text("config"), // JSON: email address, slack webhook URL, etc.
});

export const notificationItems = sqliteTable("notification_items", {
  id: text("id").primaryKey(), // UUID
  business_id: text("business_id")
    .notNull()
    .references(() => businesses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  body: text("body"),
  type: text("type", {
    enum: ["deadline", "sync", "tax", "alert", "info"],
  }).notNull(),
  read: integer("read", { mode: "boolean" }).notNull().default(false),
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(), // UUID
  user_id: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  endpoint: text("endpoint").notNull(),
  keys_json: text("keys_json").notNull(), // JSON: { p256dh, auth }
  created_at: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
