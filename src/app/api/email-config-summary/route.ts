import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { buildEmailConfig } from "@/lib/notifications/email-config";

/**
 * Lightweight summary used by the Send-invoice dialog (and any future
 * "do you have email set up?" UI) to pre-flight before the user hits send.
 * Returns whether email is configured + which provider + the from-address,
 * with NO secrets.
 */
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.activeBusiness) return NextResponse.json({ error: "No active business" }, { status: 400 });

  const db = getDb();
  const prefs = db
    .select()
    .from(schema.notificationPreferences)
    .where(eq(schema.notificationPreferences.business_id, session.activeBusiness.id))
    .all()
    .find((p) => p.channel === "email" && p.enabled);

  if (!prefs?.config) {
    return NextResponse.json({ configured: false, fromAddress: null, provider: null });
  }

  let raw: Record<string, string> | null;
  try {
    raw = JSON.parse(prefs.config);
  } catch {
    return NextResponse.json({ configured: false, fromAddress: null, provider: null });
  }

  const cfg = buildEmailConfig(raw);
  if (!cfg) {
    return NextResponse.json({
      configured: false,
      fromAddress: raw?.from_address ?? null,
      provider: raw?.provider === "graph" ? "graph" : raw?.provider ? "smtp" : null,
    });
  }

  return NextResponse.json({
    configured: true,
    fromAddress: cfg.from_address,
    provider: cfg.provider,
  });
}
