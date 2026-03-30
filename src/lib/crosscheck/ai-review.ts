import Anthropic from "@anthropic-ai/sdk";
import { getDb, schema } from "@/lib/db";
import { eq, and, desc, gte } from "drizzle-orm";
import { buildSanitisationMap, sanitise } from "@/lib/ai/sanitise";
import type { XeroContact } from "@/lib/xero/types";
import type { DetectedAnomaly } from "./anomalies";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

type AiReviewResult = {
  concerns: DetectedAnomaly[];
  overall_level: "low" | "medium" | "high";
  summary: string;
};

/**
 * Run AI review of recent changes using Claude Haiku.
 * Gathers recent changes and rule-based anomalies, sanitises PII,
 * and asks Claude to identify additional concerns.
 */
export async function runAiReview(businessId: string): Promise<AiReviewResult> {
  const db = getDb();
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Gather recent change reports
  const recentReports = db
    .select()
    .from(schema.changeReports)
    .where(
      and(
        eq(schema.changeReports.business_id, businessId),
        gte(schema.changeReports.created_at, thirtyDaysAgo)
      )
    )
    .orderBy(desc(schema.changeReports.created_at))
    .limit(20)
    .all();

  // Gather recent rule-based anomalies
  const recentAnomalies = db
    .select()
    .from(schema.anomalies)
    .where(
      and(
        eq(schema.anomalies.business_id, businessId),
        gte(schema.anomalies.created_at, thirtyDaysAgo)
      )
    )
    .orderBy(desc(schema.anomalies.created_at))
    .limit(50)
    .all();

  if (recentReports.length === 0) {
    return {
      concerns: [],
      overall_level: "low",
      summary: "No recent changes to review.",
    };
  }

  // Build sanitisation map from contacts
  const contactsCache = db
    .select()
    .from(schema.xeroCache)
    .where(
      and(
        eq(schema.xeroCache.business_id, businessId),
        eq(schema.xeroCache.entity_type, "contacts")
      )
    )
    .get();

  const contacts: XeroContact[] = contactsCache
    ? (JSON.parse(contactsCache.data)?.Contacts ?? [])
    : [];
  const sanitisationMap = buildSanitisationMap(contacts);

  // Build the review prompt
  const changesText = recentReports
    .map((r) => {
      const changes = JSON.parse(r.changes_json) as Array<{ description: string }>;
      return `## ${r.entity_type} changes (${r.created_at.toISOString().slice(0, 10)})\n${changes.map((c) => `- ${sanitise(c.description, sanitisationMap)}`).join("\n")}`;
    })
    .join("\n\n");

  const anomaliesText = recentAnomalies.length > 0
    ? `\n\n## Already-flagged anomalies\n${recentAnomalies.map((a) => `- [${a.severity}] ${sanitise(a.title, sanitisationMap)}: ${sanitise(a.description, sanitisationMap)}`).join("\n")}`
    : "";

  const prompt = `You are reviewing recent changes to a New Zealand business's Xero accounting data. Your job is to identify anything unusual that the business owner should ask their accountant about.

Here are the recent changes:

${changesText}${anomaliesText}

Please analyse these changes and respond with JSON in this exact format:
{
  "overall_level": "low" | "medium" | "high",
  "summary": "1-2 sentence overview",
  "concerns": [
    {
      "title": "short title",
      "description": "what you noticed",
      "severity": "info" | "warning" | "critical",
      "suggested_question": "A question for the accountant using non-accusatory language like 'Could you help me understand...'"
    }
  ]
}

Guidelines:
- Only flag things NOT already covered by the anomalies listed above
- Use non-accusatory language in questions
- Focus on patterns across multiple changes, not individual items
- Consider NZ-specific tax implications (GST, PAYE, provisional tax)
- If nothing additional is concerning, return an empty concerns array
- Respond with ONLY the JSON, no other text`;

  const response = await getClient().messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");

  try {
    const parsed = JSON.parse(text) as {
      overall_level: "low" | "medium" | "high";
      summary: string;
      concerns: Array<{
        title: string;
        description: string;
        severity: "info" | "warning" | "critical";
        suggested_question: string;
      }>;
    };

    const concerns: DetectedAnomaly[] = parsed.concerns.map((c) => ({
      severity: c.severity,
      category: "ai_concern",
      title: c.title,
      description: c.description,
      entity_id: null,
      suggested_question: c.suggested_question,
    }));

    return {
      concerns,
      overall_level: parsed.overall_level,
      summary: parsed.summary,
    };
  } catch {
    return {
      concerns: [],
      overall_level: "low",
      summary: "AI review completed but could not parse structured results.",
    };
  }
}
