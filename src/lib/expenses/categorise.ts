import { embed } from "@/lib/lmstudio/embeddings";
import { upsertRecords, searchTable } from "@/lib/vector/store";

const TABLE_NAME = "expense_vendors";
const CONFIDENCE_THRESHOLD = 0.75;

type VendorRecord = {
  id: string;
  business_id: string;
  vendor: string;
  description: string;
  category: string;
  count: number;
  vector: number[];
};

function normalizeVendor(vendor: string): string {
  return vendor.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export async function learnVendorCategory(
  businessId: string,
  vendor: string,
  description: string,
  category: string
): Promise<void> {
  const normalized = normalizeVendor(vendor);
  const id = `${businessId}-${normalized}`;
  const text = `${vendor} ${description || ""}`.trim();
  const vector = await embed(text);

  // Try to find existing record to increment count
  const existing = await searchTable(TABLE_NAME, vector, 1, `id = "${id}"`);
  const count = existing.length > 0 ? ((existing[0].count as number) || 0) + 1 : 1;

  const record: VendorRecord = {
    id,
    business_id: businessId,
    vendor,
    description: description || "",
    category,
    count,
    vector,
  };

  await upsertRecords(TABLE_NAME, [record], `id = "${id}"`);
}

export type CategorySuggestion = {
  category: string;
  confidence: number;
  matchedVendor: string;
};

export async function suggestCategory(
  businessId: string,
  vendor: string,
  description: string
): Promise<CategorySuggestion | null> {
  const text = `${vendor} ${description || ""}`.trim();
  const vector = await embed(text);

  const results = await searchTable(
    TABLE_NAME,
    vector,
    3,
    `business_id = "${businessId}"`
  );

  if (results.length === 0) return null;

  // Check for exact vendor match first
  const normalized = normalizeVendor(vendor);
  const exactMatch = results.find(
    (r) => normalizeVendor(r.vendor as string) === normalized
  );

  if (exactMatch) {
    return {
      category: exactMatch.category as string,
      confidence: 1.0,
      matchedVendor: exactMatch.vendor as string,
    };
  }

  // Use vector similarity — LanceDB returns results sorted by distance
  const best = results[0];
  const distance = (best._distance as number) ?? 1;
  // LanceDB L2 distance: 0 = identical. Convert to confidence.
  const confidence = Math.max(0, 1 - distance / 2);

  if (confidence < CONFIDENCE_THRESHOLD) return null;

  return {
    category: best.category as string,
    confidence: Math.round(confidence * 100) / 100,
    matchedVendor: best.vendor as string,
  };
}
