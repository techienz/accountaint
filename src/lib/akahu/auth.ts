import { randomBytes } from "crypto";
import { getIntegrationConfig } from "@/lib/integrations/config";

const AKAHU_AUTH_URL = "https://oauth.akahu.nz";
const AKAHU_TOKEN_URL = "https://api.akahu.io/v1/token";

function getAppToken(): string {
  const token = getIntegrationConfig("akahu", "app_token", "AKAHU_APP_TOKEN");
  if (!token) throw new Error("Akahu App Token not configured. Set it in Settings > Bank Feeds.");
  return token;
}

function getAppSecret(): string {
  const secret = getIntegrationConfig("akahu", "app_secret", "AKAHU_APP_SECRET");
  if (!secret) throw new Error("Akahu App Secret not configured. Set it in Settings > Bank Feeds.");
  return secret;
}

function getRedirectUri(): string {
  const uri = getIntegrationConfig("akahu", "redirect_uri", "AKAHU_REDIRECT_URI");
  if (!uri) throw new Error("Akahu Redirect URI not configured. Set it in Settings > Bank Feeds.");
  return uri;
}

/**
 * Generate an Akahu OAuth2 authorization URL.
 * State param encodes userId:nonce for CSRF protection.
 */
export function getAuthUrl(userId: string): {
  url: string;
  nonce: string;
} {
  const nonce = randomBytes(16).toString("hex");
  const state = `${userId}:${nonce}`;

  const params = new URLSearchParams({
    response_type: "code",
    client_id: getAppToken(),
    redirect_uri: getRedirectUri(),
    state,
  });

  return {
    url: `${AKAHU_AUTH_URL}?${params.toString()}`,
    nonce,
  };
}

/**
 * Parse state param back into userId and nonce.
 */
export function parseState(state: string): {
  userId: string;
  nonce: string;
} | null {
  const parts = state.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  return { userId: parts[0], nonce: parts[1] };
}

/**
 * Exchange an authorization code for an access token (enduring consent).
 * Akahu uses enduring consent — no refresh token needed.
 */
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
}> {
  const response = await fetch(AKAHU_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: getAppToken(),
      client_secret: getAppSecret(),
      redirect_uri: getRedirectUri(),
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Akahu token exchange failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return { access_token: data.access_token };
}
