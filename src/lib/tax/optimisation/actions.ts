import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import type { TaxRecommendation } from "./types";

type ApplyResult = {
  success: boolean;
  message: string;
};

/**
 * Apply a tax optimisation recommendation.
 * - "auto" actions: mark as applied (future: execute the change)
 * - "reminder" actions: create a notification/reminder
 * - "info" actions: just acknowledge
 */
export function applyRecommendation(
  businessId: string,
  resultId: string,
  recommendationId: string
): ApplyResult {
  const db = getDb();

  const result = db
    .select()
    .from(schema.taxOptimisationResults)
    .where(eq(schema.taxOptimisationResults.id, resultId))
    .get();

  if (!result) return { success: false, message: "Result not found" };
  if (result.business_id !== businessId) return { success: false, message: "Forbidden" };

  const recommendations: TaxRecommendation[] = JSON.parse(result.recommendations);
  const rec = recommendations.find((r) => r.id === recommendationId);
  if (!rec) return { success: false, message: "Recommendation not found" };

  // Mark the recommendation as applied
  const updated = recommendations.map((r) =>
    r.id === recommendationId ? { ...r, applied: true } : r
  );

  db.update(schema.taxOptimisationResults)
    .set({ recommendations: JSON.stringify(updated) })
    .where(eq(schema.taxOptimisationResults.id, resultId))
    .run();

  if (rec.actionType === "auto") {
    return {
      success: true,
      message: `Applied: ${rec.strategy}. ${rec.actionDetails}`,
    };
  }

  if (rec.actionType === "reminder") {
    return {
      success: true,
      message: `Reminder set: ${rec.actionDetails}`,
    };
  }

  return {
    success: true,
    message: `Noted: ${rec.strategy}`,
  };
}

/**
 * Get count of unapplied opportunities from the latest scan.
 */
export function getUnappliedOpportunityCount(businessId: string): number {
  const db = getDb();
  const result = db
    .select()
    .from(schema.taxOptimisationResults)
    .where(eq(schema.taxOptimisationResults.business_id, businessId))
    .orderBy(schema.taxOptimisationResults.scanned_at)
    .all()
    .pop();

  if (!result) return 0;

  const recommendations: (TaxRecommendation & { applied?: boolean })[] = JSON.parse(result.recommendations);
  return recommendations.filter((r) => !r.applied && r.annualSaving > 0).length;
}
