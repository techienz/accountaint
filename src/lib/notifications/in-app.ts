import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";

type CreateNotificationInput = {
  business_id: string;
  title: string;
  body?: string;
  type: "deadline" | "sync" | "tax" | "alert" | "info";
};

export function createNotification(input: CreateNotificationInput) {
  const db = getDb();
  db.insert(schema.notificationItems)
    .values({
      id: uuid(),
      business_id: input.business_id,
      title: input.title,
      body: input.body || null,
      type: input.type,
    })
    .run();
}

export function getNotifications(businessId: string, limit = 20) {
  const db = getDb();
  return db
    .select()
    .from(schema.notificationItems)
    .where(eq(schema.notificationItems.business_id, businessId))
    .orderBy(desc(schema.notificationItems.created_at))
    .limit(limit)
    .all();
}

export function getUnreadCount(businessId: string): number {
  const db = getDb();
  return db
    .select()
    .from(schema.notificationItems)
    .where(
      and(
        eq(schema.notificationItems.business_id, businessId),
        eq(schema.notificationItems.read, false)
      )
    )
    .all()
    .length;
}

export function markNotificationRead(notificationId: string, businessId: string) {
  const db = getDb();
  db.update(schema.notificationItems)
    .set({ read: true })
    .where(
      and(
        eq(schema.notificationItems.id, notificationId),
        eq(schema.notificationItems.business_id, businessId)
      )
    )
    .run();
}
