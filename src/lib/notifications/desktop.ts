import webPush from "web-push";
import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

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

export function getVapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY ?? null;
}

export function saveSubscription(userId: string, subscription: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  const db = getDb();
  // Replace any existing subscription with the same endpoint (re-subscribes)
  db.delete(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.endpoint, subscription.endpoint))
    .run();
  db.insert(schema.pushSubscriptions)
    .values({
      id: uuid(),
      user_id: userId,
      endpoint: subscription.endpoint,
      keys_json: JSON.stringify(subscription.keys),
    })
    .run();
}

export function removeSubscription(userId: string, endpoint: string): boolean {
  const db = getDb();
  const result = db
    .delete(schema.pushSubscriptions)
    .where(
      and(
        eq(schema.pushSubscriptions.user_id, userId),
        eq(schema.pushSubscriptions.endpoint, endpoint)
      )
    )
    .run();
  return result.changes > 0;
}

export function countSubscriptions(userId: string): number {
  const db = getDb();
  return db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.user_id, userId))
    .all().length;
}

export type PushSendResult = {
  attempted: number;
  succeeded: number;
  cleaned_up: number;
  errors: Array<{ statusCode?: number; message: string; endpoint: string }>;
};

export async function sendPushToUser(userId: string, payload: {
  title: string;
  body?: string;
  url?: string;
}): Promise<PushSendResult> {
  const result: PushSendResult = {
    attempted: 0,
    succeeded: 0,
    cleaned_up: 0,
    errors: [],
  };

  if (!initVapid()) {
    result.errors.push({ message: "VAPID not configured", endpoint: "" });
    return result;
  }

  const db = getDb();
  const subscriptions = db
    .select()
    .from(schema.pushSubscriptions)
    .where(eq(schema.pushSubscriptions.user_id, userId))
    .all();

  const message = JSON.stringify(payload);

  for (const sub of subscriptions) {
    result.attempted++;
    try {
      const keys = JSON.parse(sub.keys_json);
      await webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } },
        message
      );
      result.succeeded++;
    } catch (error: unknown) {
      const e = error as { statusCode?: number; message?: string; body?: string };
      const endpointShort = sub.endpoint.slice(0, 60) + "...";
      const statusCode = e.statusCode;
      const errMsg = e.body || e.message || "unknown error";
      console.error(
        `[push] send failed for ${endpointShort} status=${statusCode}:`,
        errMsg
      );
      result.errors.push({
        statusCode,
        message: errMsg,
        endpoint: endpointShort,
      });
      // 404/410 = subscription gone. Clean up.
      if (statusCode === 404 || statusCode === 410) {
        db.delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.id, sub.id))
          .run();
        result.cleaned_up++;
      }
    }
  }
  return result;
}
