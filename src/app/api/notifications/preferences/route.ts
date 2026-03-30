import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { encrypt } from "@/lib/crypto";
import { getBusiness } from "@/lib/business";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = request.nextUrl.searchParams.get("businessId");
  if (!businessId) {
    return NextResponse.json({ error: "businessId required" }, { status: 400 });
  }

  const biz = getBusiness(session.user.id, businessId);
  if (!biz) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();
  const prefs = db
    .select()
    .from(schema.notificationPreferences)
    .where(eq(schema.notificationPreferences.business_id, businessId))
    .all();

  return NextResponse.json({ preferences: prefs });
}

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { businessId, preferences } = body;

  if (!businessId || !preferences) {
    return NextResponse.json({ error: "businessId and preferences required" }, { status: 400 });
  }

  const biz = getBusiness(session.user.id, businessId);
  if (!biz) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();

  // Delete existing prefs for this business
  db.delete(schema.notificationPreferences)
    .where(eq(schema.notificationPreferences.business_id, businessId))
    .run();

  // Insert new prefs
  for (const [channel, pref] of Object.entries(preferences)) {
    const p = pref as { enabled: boolean; detail_level: string; config: Record<string, string> };

    // Encrypt smtp_pass if present
    const config = { ...p.config };
    if (config.smtp_pass && config.smtp_pass !== "") {
      config.smtp_pass = encrypt(config.smtp_pass);
    } else {
      delete config.smtp_pass;
    }

    db.insert(schema.notificationPreferences)
      .values({
        id: uuid(),
        business_id: businessId,
        channel: channel as "email" | "desktop" | "slack" | "in_app",
        enabled: p.enabled,
        detail_level: (p.detail_level || "vague") as "vague" | "detailed",
        config: JSON.stringify(config),
      })
      .run();
  }

  return NextResponse.json({ success: true });
}
