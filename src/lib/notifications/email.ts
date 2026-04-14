import nodemailer from "nodemailer";

export type SmtpConfig = {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string; // decrypted
  from_address: string;
  to_address: string;
};

export type EmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

export async function sendEmail(
  config: SmtpConfig,
  subject: string,
  html: string,
  attachments?: EmailAttachment[],
  cc?: string[]
): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.smtp_host,
    port: config.smtp_port,
    secure: config.smtp_port === 465,
    auth: {
      user: config.smtp_user,
      pass: config.smtp_pass,
    },
  });

  await transporter.sendMail({
    from: config.from_address,
    to: config.to_address,
    cc: cc && cc.length > 0 ? cc.join(", ") : undefined,
    subject,
    html: wrapHtml(html),
    attachments: attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      contentType: a.contentType,
    })),
  });
}

function wrapHtml(body: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; }
  .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e5e5; font-size: 12px; color: #666; }
</style></head>
<body>
${body}
<div class="footer">Sent by Accountaint</div>
</body>
</html>`;
}
