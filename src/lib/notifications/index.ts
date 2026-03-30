import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createNotification } from "./in-app";
import { sendPushToUser } from "./desktop";
import { sendEmail, type SmtpConfig } from "./email";
import { sendSlack } from "./slack";
import { generateIcs } from "./ics";
import { decrypt } from "@/lib/crypto";

type NotifyInput = {
  businessId: string;
  userId: string;
  title: string;
  body?: string;
  vagueTitle: string;
  vagueBody?: string;
  type: "deadline" | "sync" | "tax" | "alert" | "info";
  deadlineDate?: string; // YYYY-MM-DD, for ICS attachment
  businessName?: string;
};

export async function notify(input: NotifyInput) {
  const db = getDb();

  const prefs = db
    .select()
    .from(schema.notificationPreferences)
    .where(eq(schema.notificationPreferences.business_id, input.businessId))
    .all();

  createNotification({
    business_id: input.businessId,
    title: input.vagueTitle,
    body: input.vagueBody,
    type: input.type,
  });

  for (const pref of prefs) {
    if (!pref.enabled) continue;

    const isDetailed = pref.detail_level === "detailed";
    const title = isDetailed ? input.title : input.vagueTitle;
    const body = isDetailed ? input.body : input.vagueBody;

    switch (pref.channel) {
      case "desktop":
        await sendPushToUser(input.userId, { title, body });
        break;

      case "email": {
        try {
          const config = pref.config ? JSON.parse(pref.config) : null;
          if (!config?.smtp_host || !config?.to_address) break;

          const smtpConfig: SmtpConfig = {
            smtp_host: config.smtp_host,
            smtp_port: config.smtp_port || 587,
            smtp_user: config.smtp_user || "",
            smtp_pass: config.smtp_pass ? decrypt(config.smtp_pass) : "",
            from_address: config.from_address || config.smtp_user || "",
            to_address: config.to_address,
          };

          // Email subjects are always vague for security
          const emailSubject = `Accountaint: ${input.vagueTitle}`;
          const emailBody = isDetailed
            ? `<h2>${title}</h2><p>${body || ""}</p>`
            : `<h2>${input.vagueTitle}</h2><p>${input.vagueBody || ""}</p>`;

          const attachments = [];
          if (input.type === "deadline" && input.deadlineDate) {
            const icsBuffer = generateIcs({
              title: input.vagueTitle, // No financial data in ICS
              date: input.deadlineDate,
            });
            attachments.push({
              filename: "deadline.ics",
              content: icsBuffer,
              contentType: "text/calendar",
            });
          }

          await sendEmail(smtpConfig, emailSubject, emailBody, attachments.length > 0 ? attachments : undefined);
        } catch (err) {
          console.error("Email notification failed:", err instanceof Error ? err.message : err);
        }
        break;
      }

      case "slack": {
        try {
          const config = pref.config ? JSON.parse(pref.config) : null;
          if (!config?.webhook_url) break;

          await sendSlack(config.webhook_url, {
            title: title || "",
            body,
            type: input.type,
            businessName: input.businessName,
          });
        } catch (err) {
          console.error("Slack notification failed:", err instanceof Error ? err.message : err);
        }
        break;
      }
    }
  }
}
