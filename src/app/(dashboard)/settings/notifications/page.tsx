import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { NotificationPrefsClient } from "./notification-prefs-client";

export default async function NotificationPrefsPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.activeBusiness) redirect("/settings?new=true");

  const db = getDb();
  const prefs = db
    .select()
    .from(schema.notificationPreferences)
    .where(
      eq(schema.notificationPreferences.business_id, session.activeBusiness.id)
    )
    .all();

  // Parse config JSON, mask sensitive fields
  const prefsData = prefs.map((p) => {
    const config = p.config ? JSON.parse(p.config) : {};
    // Mask smtp_pass for display
    if (config.smtp_pass) {
      config.smtp_pass_set = true;
      delete config.smtp_pass;
    }
    return {
      id: p.id,
      channel: p.channel,
      enabled: p.enabled,
      detail_level: p.detail_level,
      config,
    };
  });

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-2xl font-semibold">Notification Preferences</h1>
      <NotificationPrefsClient
        businessId={session.activeBusiness.id}
        preferences={prefsData}
      />
    </div>
  );
}
