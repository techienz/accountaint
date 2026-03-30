import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { getBusiness } from "@/lib/business";
import { sendEmail, type SmtpConfig } from "@/lib/notifications/email";
import { sendSlack } from "@/lib/notifications/slack";
import { decrypt } from "@/lib/crypto";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { businessId, channel } = body;

  if (!businessId || !channel) {
    return NextResponse.json({ error: "businessId and channel required" }, { status: 400 });
  }

  const biz = getBusiness(session.user.id, businessId);
  if (!biz) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();
  const pref = db
    .select()
    .from(schema.notificationPreferences)
    .where(eq(schema.notificationPreferences.business_id, businessId))
    .all()
    .find((p) => p.channel === channel);

  if (!pref?.config) {
    return NextResponse.json({ error: "Channel not configured" }, { status: 400 });
  }

  const config = JSON.parse(pref.config);

  try {
    if (channel === "email") {
      if (!config.smtp_host || !config.to_address) {
        return NextResponse.json({ error: "SMTP not fully configured" }, { status: 400 });
      }

      const smtpConfig: SmtpConfig = {
        smtp_host: config.smtp_host,
        smtp_port: parseInt(config.smtp_port) || 587,
        smtp_user: config.smtp_user || "",
        smtp_pass: config.smtp_pass ? decrypt(config.smtp_pass) : "",
        from_address: config.from_address || config.smtp_user || "",
        to_address: config.to_address,
      };

      await sendEmail(
        smtpConfig,
        "Accountaint: Test notification",
        "<h2>Test notification</h2><p>This is a test email from Accountaint. If you received this, your email notifications are working correctly.</p>"
      );

      return NextResponse.json({ success: true });
    }

    if (channel === "slack") {
      if (!config.webhook_url) {
        return NextResponse.json({ error: "Slack webhook URL not configured" }, { status: 400 });
      }

      await sendSlack(config.webhook_url, {
        title: "Test notification",
        body: "This is a test message from Accountaint. If you see this, Slack notifications are working correctly.",
        type: "info",
        businessName: biz.name,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Test not supported for this channel" }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Test failed" },
      { status: 500 }
    );
  }
}
