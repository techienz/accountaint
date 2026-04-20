import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { createNotification } from "./in-app";
import { sendPushToUser } from "./desktop";
import { sendEmail } from "./email";
import { buildEmailConfig } from "./email-config";
import { recordEmail } from "@/lib/email-log";
import { sendSlack } from "./slack";
import { generateIcs } from "./ics";

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
          const rawConfig = pref.config ? JSON.parse(pref.config) : null;
          const emailConfig = buildEmailConfig(rawConfig);
          if (!emailConfig) break;

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

          try {
            await sendEmail(emailConfig, emailSubject, emailBody, attachments.length > 0 ? attachments : undefined);
            recordEmail({
              businessId: input.businessId,
              kind: "notification",
              provider: emailConfig.provider === "graph" ? "graph" : "smtp",
              fromAddress: emailConfig.from_address,
              toAddress: emailConfig.to_address,
              subject: emailSubject,
              attachmentNames: attachments.map((a) => a.filename),
              success: true,
              relatedEntityType: input.type ?? null,
            });
          } catch (sendErr) {
            recordEmail({
              businessId: input.businessId,
              kind: "notification",
              provider: emailConfig.provider === "graph" ? "graph" : "smtp",
              fromAddress: emailConfig.from_address,
              toAddress: emailConfig.to_address,
              subject: emailSubject,
              attachmentNames: attachments.map((a) => a.filename),
              success: false,
              errorMessage: sendErr instanceof Error ? sendErr.message : String(sendErr),
              relatedEntityType: input.type ?? null,
            });
            throw sendErr;
          }
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
