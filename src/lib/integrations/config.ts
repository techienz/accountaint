import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";

/**
 * Get an integration config value. Checks DB first, then env var fallback.
 */
export function getIntegrationConfig(
  integration: string,
  key: string,
  envFallback?: string
): string | null {
  const db = getDb();
  const row = db
    .select()
    .from(schema.integrationConfig)
    .where(
      and(
        eq(schema.integrationConfig.integration, integration),
        eq(schema.integrationConfig.key, key)
      )
    )
    .get();

  if (row) {
    return decrypt(row.value);
  }

  // Env var fallback
  if (envFallback) {
    return process.env[envFallback] || null;
  }

  return null;
}

/**
 * Set an integration config value (encrypted).
 */
export function setIntegrationConfig(
  integration: string,
  key: string,
  value: string
): void {
  const db = getDb();
  const existing = db
    .select()
    .from(schema.integrationConfig)
    .where(
      and(
        eq(schema.integrationConfig.integration, integration),
        eq(schema.integrationConfig.key, key)
      )
    )
    .get();

  if (existing) {
    db.update(schema.integrationConfig)
      .set({ value: encrypt(value) })
      .where(eq(schema.integrationConfig.id, existing.id))
      .run();
  } else {
    db.insert(schema.integrationConfig)
      .values({
        id: uuid(),
        integration,
        key,
        value: encrypt(value),
      })
      .run();
  }
}

/**
 * Get all config for an integration (decrypted).
 */
export function getIntegrationConfigs(integration: string): Record<string, string> {
  const db = getDb();
  const rows = db
    .select()
    .from(schema.integrationConfig)
    .where(eq(schema.integrationConfig.integration, integration))
    .all();

  const result: Record<string, string> = {};
  for (const row of rows) {
    result[row.key] = decrypt(row.value);
  }
  return result;
}

/**
 * Check if an integration is configured (has all required keys).
 */
export function isIntegrationConfigured(
  integration: string,
  requiredKeys: string[]
): boolean {
  const configs = getIntegrationConfigs(integration);
  return requiredKeys.every((key) => configs[key] && configs[key].length > 0);
}
