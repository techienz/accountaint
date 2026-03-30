import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { encrypt, decrypt } from "@/lib/crypto";
import { isCustomConnection, getClientCredentialsToken } from "./auth";

const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000;

interface AuthedClient {
  accessToken: string;
  tenantId: string;
}

async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const clientId = process.env.XERO_CLIENT_ID;
  const clientSecret = process.env.XERO_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("XERO_CLIENT_ID and XERO_CLIENT_SECRET must be set");
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

export async function getAuthedClient(businessId: string): Promise<AuthedClient> {
  const db = getDb();

  const connection = db
    .select()
    .from(schema.xeroConnections)
    .where(eq(schema.xeroConnections.business_id, businessId))
    .get();

  if (!connection) {
    throw new Error("No Xero connection found for this business");
  }

  const now = Date.now();
  const tokenExpiresAt = connection.token_expires_at.getTime();
  const isExpired = tokenExpiresAt - TOKEN_EXPIRY_BUFFER_MS < now;

  if (isExpired) {
    if (isCustomConnection()) {
      // Custom connections use client_credentials grant — no refresh token
      const tokens = await getClientCredentialsToken();

      db.update(schema.xeroConnections)
        .set({
          access_token: encrypt(tokens.access_token),
          token_expires_at: new Date(now + tokens.expires_in * 1000),
          updated_at: new Date(),
        })
        .where(eq(schema.xeroConnections.business_id, businessId))
        .run();

      return { accessToken: tokens.access_token, tenantId: connection.tenant_id };
    }

    // Web app connections use refresh_token grant
    const currentRefreshToken = decrypt(connection.refresh_token);
    const tokens = await refreshAccessToken(currentRefreshToken);

    db.update(schema.xeroConnections)
      .set({
        access_token: encrypt(tokens.access_token),
        refresh_token: encrypt(tokens.refresh_token),
        token_expires_at: new Date(now + tokens.expires_in * 1000),
        updated_at: new Date(),
      })
      .where(eq(schema.xeroConnections.business_id, businessId))
      .run();

    return { accessToken: tokens.access_token, tenantId: connection.tenant_id };
  }

  return { accessToken: decrypt(connection.access_token), tenantId: connection.tenant_id };
}
