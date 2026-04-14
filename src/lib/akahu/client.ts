import { getIntegrationConfig } from "@/lib/integrations/config";

const AKAHU_API_BASE = "https://api.akahu.io";

function getAppToken(): string {
  const token = getIntegrationConfig("akahu", "app_token", "AKAHU_APP_TOKEN");
  if (!token) throw new Error("Akahu App Token not configured. Set it in Settings > Bank Feeds.");
  return token;
}

function getUserToken(): string {
  const token = getIntegrationConfig("akahu", "user_token", "AKAHU_USER_TOKEN");
  if (!token) throw new Error("Akahu User Token not configured. Set it in Settings > Bank Feeds.");
  return token;
}

/**
 * Generic GET request to Akahu API with auth headers.
 * For personal apps, uses the stored user token directly.
 * For full apps, uses the provided access token from OAuth.
 */
export async function akahuGet<T = unknown>(
  accessToken: string | null,
  path: string
): Promise<T> {
  const url = `${AKAHU_API_BASE}${path}`;
  const bearerToken = accessToken || getUserToken();
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "X-Akahu-Id": getAppToken(),
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Akahu API error (${path}): ${response.status} ${errorText}`);
  }

  return response.json();
}

// ── Account types ──────────────────────────────────────────────────

export type AkahuAccount = {
  _id: string;
  name: string;
  status: string;
  type: string;
  attributes: string[];
  balance?: {
    current: number;
    available?: number;
  };
  connection: {
    _id: string;
    name: string;
  };
  meta?: {
    holder?: string;
    type?: string;
  };
};

export type AkahuTransaction = {
  _id: string;
  _account: string;
  date: string; // ISO date string
  description: string;
  amount: number;
  balance?: number;
  type: string;
  merchant?: {
    _id: string;
    name: string;
  };
  meta?: {
    particulars?: string;
    code?: string;
    reference?: string;
  };
};

// ── Endpoint wrappers ──────────────────────────────────────────────

/**
 * Fetch all accounts for this user.
 */
export async function fetchAccounts(
  accessToken: string | null = null
): Promise<AkahuAccount[]> {
  const data = await akahuGet<{ items: AkahuAccount[] }>(
    accessToken,
    "/v1/accounts"
  );
  return data.items ?? [];
}

/**
 * Fetch transactions for a specific account.
 */
export async function fetchTransactions(
  accessToken: string | null = null,
  accountId: string,
  options?: { start?: string; end?: string }
): Promise<AkahuTransaction[]> {
  const params = new URLSearchParams();
  if (options?.start) params.set("start", options.start);
  if (options?.end) params.set("end", options.end);

  const query = params.toString();
  const path = `/v1/accounts/${accountId}/transactions${query ? `?${query}` : ""}`;

  const data = await akahuGet<{ items: AkahuTransaction[] }>(
    accessToken,
    path
  );
  return data.items ?? [];
}

/**
 * Revoke the user's access token (enduring consent).
 */
export async function revokeToken(accessToken: string | null = null): Promise<void> {
  const url = `${AKAHU_API_BASE}/v1/token`;
  const bearerToken = accessToken || getUserToken();
  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: `Bearer ${bearerToken}`,
      "X-Akahu-Id": getAppToken(),
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Akahu token revocation failed: ${response.status} ${errorText}`);
  }
}
