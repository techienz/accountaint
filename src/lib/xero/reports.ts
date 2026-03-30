import { getAuthedClient } from "./client";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

const XERO_API_BASE = "https://api.xero.com";

type ReportParams = Record<string, string>;

/**
 * Fetch a report from Xero on-demand (not cached).
 * Falls back to cached data if Xero is disconnected.
 */
export async function fetchXeroReport(
  businessId: string,
  reportType: string,
  params?: ReportParams
): Promise<{ data: unknown; fromCache: boolean }> {
  try {
    const { accessToken, tenantId } = await getAuthedClient(businessId);

    const searchParams = new URLSearchParams(params);
    const queryString = searchParams.toString();
    const path = `/api.xro/2.0/Reports/${reportType}${queryString ? `?${queryString}` : ""}`;

    const response = await fetch(`${XERO_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "xero-tenant-id": tenantId,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Xero API error ${response.status}`);
    }

    const data = await response.json();
    return { data, fromCache: false };
  } catch {
    // Fall back to cached data
    const cacheType = reportTypeToCacheKey(reportType);
    if (cacheType) {
      const db = getDb();
      const cached = db
        .select()
        .from(schema.xeroCache)
        .where(eq(schema.xeroCache.business_id, businessId))
        .all()
        .find((c) => c.entity_type === cacheType);

      if (cached) {
        return { data: JSON.parse(cached.data), fromCache: true };
      }
    }

    return { data: null, fromCache: true };
  }
}

function reportTypeToCacheKey(reportType: string): string | null {
  const map: Record<string, string> = {
    ProfitAndLoss: "profit_loss",
    BalanceSheet: "balance_sheet",
  };
  return map[reportType] || null;
}
