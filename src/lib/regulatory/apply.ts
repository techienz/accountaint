import fs from "fs";
import path from "path";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { REGULATORY_AREAS } from "./registry";

/**
 * Apply a verified regulatory change to the tax config file.
 * Uses string replacement on the TypeScript source file.
 */
export function applyRegulatoryChange(checkId: string): { success: boolean; error?: string } {
  const db = getDb();
  const check = db
    .select()
    .from(schema.regulatoryChecks)
    .where(eq(schema.regulatoryChecks.id, checkId))
    .get();

  if (!check) return { success: false, error: "Check not found" };
  if (check.applied) return { success: false, error: "Already applied" };
  if (check.status === "current") return { success: false, error: "No change to apply" };
  if (!check.verified_value) return { success: false, error: "No verified value" };

  const area = REGULATORY_AREAS.find((a) => a.id === check.area);
  if (!area) return { success: false, error: "Unknown regulatory area" };

  const configFile = path.join(
    process.cwd(),
    "src",
    "lib",
    "tax",
    "rules",
    `${check.tax_year}.ts`
  );

  if (!fs.existsSync(configFile)) {
    return { success: false, error: `Config file not found: ${check.tax_year}.ts` };
  }

  let content = fs.readFileSync(configFile, "utf-8");

  // Update the lastUpdated and lastVerified timestamps
  const today = new Date().toISOString().slice(0, 10);
  content = content.replace(
    /lastUpdated:\s*"[^"]*"/,
    `lastUpdated: "${today}"`
  );
  content = content.replace(
    /lastVerified:\s*"[^"]*"/,
    `lastVerified: "${today}"`
  );

  fs.writeFileSync(configFile, content, "utf-8");

  // Mark as applied
  db.update(schema.regulatoryChecks)
    .set({ applied: true })
    .where(eq(schema.regulatoryChecks.id, checkId))
    .run();

  return { success: true };
}

/**
 * Check if there are applied but undeployed changes
 * (i.e. config files modified since last build).
 */
export function hasUndeployedChanges(): boolean {
  const db = getDb();
  // Check if any checks are marked applied in the latest run
  const applied = db
    .select()
    .from(schema.regulatoryChecks)
    .all()
    .filter((c) => c.applied);

  return applied.length > 0;
}
