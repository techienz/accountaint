import OpenAI from "openai";

let client: OpenAI | null = null;

export function getLmStudioClient(): OpenAI {
  if (client) return client;
  const baseURL = process.env.LMSTUDIO_URL || "http://localhost:1234/v1";
  client = new OpenAI({ baseURL, apiKey: "lm-studio" });
  return client;
}

let healthCache: { available: boolean; checkedAt: number } | null = null;
const HEALTH_CACHE_TTL = 30_000; // 30 seconds

export async function checkLmStudioHealth(): Promise<boolean> {
  const now = Date.now();
  if (healthCache && now - healthCache.checkedAt < HEALTH_CACHE_TTL) {
    return healthCache.available;
  }

  try {
    const baseURL = process.env.LMSTUDIO_URL || "http://localhost:1234";
    const response = await fetch(`${baseURL}/v1/models`, {
      signal: AbortSignal.timeout(2000),
    });
    const available = response.ok;
    healthCache = { available, checkedAt: now };
    return available;
  } catch {
    healthCache = { available: false, checkedAt: now };
    return false;
  }
}

export function isLmStudioAvailable(): boolean {
  if (!healthCache) return false;
  if (Date.now() - healthCache.checkedAt > HEALTH_CACHE_TTL) return false;
  return healthCache.available;
}
