import { randomBytes } from "crypto";
import type { XeroTenant } from "./types";

const XERO_AUTH_URL = "https://login.xero.com/identity/connect/authorize";
const XERO_TOKEN_URL = "https://identity.xero.com/connect/token";
const XERO_CONNECTIONS_URL = "https://api.xero.com/connections";

// Scopes for web app OAuth2 flow
const WEB_APP_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
  "accounting.transactions",
  "accounting.contacts",
  "accounting.settings",
].join(" ");

function getClientId(): string {
  const id = process.env.XERO_CLIENT_ID;
  if (!id) throw new Error("XERO_CLIENT_ID environment variable is not set");
  return id;
}

function getClientSecret(): string {
  const secret = process.env.XERO_CLIENT_SECRET;
  if (!secret)
    throw new Error("XERO_CLIENT_SECRET environment variable is not set");
  return secret;
}

function getRedirectUri(): string {
  const uri = process.env.XERO_REDIRECT_URI;
  if (!uri)
    throw new Error("XERO_REDIRECT_URI environment variable is not set");
  return uri;
}

/**
 * Check if the app is configured as a custom connection (client_credentials).
 * Custom connections don't need a redirect URI.
 */
export function isCustomConnection(): boolean {
  return process.env.XERO_GRANT_TYPE === "client_credentials";
}

// ── Custom Connection (client_credentials) ─────────────────────────

/**
 * Get tokens using client_credentials grant (custom connection).
 * No user interaction needed — pre-authorised to a single org.
 */
export async function getClientCredentialsToken(): Promise<{
  access_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const credentials = Buffer.from(
    `${getClientId()}:${getClientSecret()}`
  ).toString("base64");

  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Client credentials token failed: ${response.status} ${errorText}`
    );
  }

  return response.json();
}

// ── Web App OAuth2 (authorization_code) ────────────────────────────

/**
 * Generate a Xero OAuth2 authorization URL (web app flow).
 * State param encodes businessId:nonce for CSRF protection.
 */
export function getAuthUrl(businessId: string): {
  url: string;
  nonce: string;
} {
  const nonce = randomBytes(16).toString("hex");
  const state = `${businessId}:${nonce}`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    scope: WEB_APP_SCOPES,
    state,
  });

  return {
    url: `${XERO_AUTH_URL}?${params.toString()}`,
    nonce,
  };
}

/**
 * Parse state param back into businessId and nonce.
 */
export function parseState(state: string): {
  businessId: string;
  nonce: string;
} | null {
  const parts = state.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { businessId: parts[0], nonce: parts[1] };
}

/**
 * Exchange an authorization code for access and refresh tokens (web app flow).
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}> {
  const credentials = Buffer.from(
    `${getClientId()}:${getClientSecret()}`
  ).toString("base64");

  const response = await fetch(XERO_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  return response.json();
}

// ── Shared ──────────────────────────────────────────────────────────

/**
 * Fetch the list of tenants (organisations) connected to this token.
 */
export async function getConnectedTenants(
  accessToken: string
): Promise<XeroTenant[]> {
  const response = await fetch(XERO_CONNECTIONS_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get tenants: ${response.status} ${errorText}`
    );
  }

  return response.json();
}
