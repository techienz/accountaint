// Microsoft Graph API email transport (for Office 365).
// Uses OAuth2 client_credentials to send mail as a configured mailbox via
// POST /v1.0/users/{from}/sendMail. No SMTP, no Basic Auth — works with
// Security Defaults enabled.
//
// Required Azure setup:
//   1. App registration in Entra ID
//   2. API permission: Microsoft Graph → Application → Mail.Send (admin consent)
//   3. Client secret created
//   4. Optional but recommended: ApplicationAccessPolicy restricting sending
//      to a single mailbox (PowerShell)

export type GraphConfig = {
  tenant_id: string;
  client_id: string;
  client_secret: string; // decrypted
  from_address: string; // UPN of the mailbox to send as
  to_address: string;
};

export type GraphEmailAttachment = {
  filename: string;
  content: Buffer;
  contentType: string;
};

type CachedToken = { token: string; expiresAt: number };
const tokenCache = new Map<string, CachedToken>();

async function getAccessToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const cacheKey = `${tenantId}:${clientId}`;
  const cached = tokenCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.token;
  }

  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://graph.microsoft.com/.default",
    grant_type: "client_credentials",
  });

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(
      `Failed to obtain access token (${response.status}): ${errBody.slice(0, 400)}`
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  tokenCache.set(cacheKey, {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  });

  return data.access_token;
}

export async function sendEmailViaGraph(
  config: GraphConfig,
  subject: string,
  html: string,
  attachments?: GraphEmailAttachment[],
  cc?: string[]
): Promise<void> {
  const token = await getAccessToken(
    config.tenant_id,
    config.client_id,
    config.client_secret
  );

  const message = {
    message: {
      subject,
      body: {
        contentType: "HTML",
        content: html,
      },
      toRecipients: [{ emailAddress: { address: config.to_address } }],
      ccRecipients:
        cc && cc.length > 0
          ? cc.map((address) => ({ emailAddress: { address } }))
          : undefined,
      attachments: attachments?.map((a) => ({
        "@odata.type": "#microsoft.graph.fileAttachment",
        name: a.filename,
        contentType: a.contentType,
        contentBytes: a.content.toString("base64"),
      })),
    },
    saveToSentItems: false,
  };

  const url = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(config.from_address)}/sendMail`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(message),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(
      `Graph sendMail failed (${response.status}): ${errBody.slice(0, 600)}`
    );
  }

  // Log success so we can audit after the fact. Includes recipient breakdown.
  const ccList = cc && cc.length > 0 ? ` cc=${cc.join(",")}` : "";
  console.log(
    `[graph-email] sent from=${config.from_address} to=${config.to_address}${ccList} subject=${JSON.stringify(subject)} attachments=${attachments?.length ?? 0}`
  );
}
