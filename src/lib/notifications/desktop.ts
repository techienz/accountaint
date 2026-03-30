import webPush from "web-push";
import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

function initVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const email = process.env.VAPID_EMAIL;

  if (!publicKey || !privateKey || !email) {
    return false;
  }

  webPush.setVapidDetails(email, publicKey, privateKey);
  return true;
}

export function saveSubscription(userId: string, subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  const db = getDb();
  db.insert(schema.pushSubscriptions)
    .values({
      id: uuid(),
      user_id: userId,
      endpoint: subscription.endpoint,
      keys_json: JSON.stringify(subscription.keys),
    })
    .run();
}

export async function sendPushToUser(userId: string, payload: {
  title: string;
  body?: string;
  url?: string;
}) {
  if (!initVapid()) return;

  const db = getDb();
  const subscriptions = db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.user_id, userId))
    .all();

  const message = JSON.stringify(payload);

  for (const sub of subscriptions) {
    try {
      const keys = JSON.parse(sub.keys_json);
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
        message
      );
    } catch (error: unknown) {
      if (error && typeof error === "object" && "statusCode" in error && (error as { statusCode: number }).statusCode === 410) {
        db.delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.id, sub.id))
          .run();
      }
    }
  }
}
