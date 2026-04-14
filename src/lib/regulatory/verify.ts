import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { getNzTaxYear } from "@/lib/tax/rules";
import { REGULATORY_AREAS, getCurrentValues } from "./registry";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY required for regulatory verification");
  }
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

type VerifyAreaResult = {
  verified_value: string;
  status: "current" | "changed" | "uncertain";
  source_url: string;
  notes: string;
};

async function verifyArea(
  areaId: string,
  areaLabel: string,
  areaDescription: string,
  currentDisplay: string,
  taxYear: number
): Promise<VerifyAreaResult> {
  const prompt = `You are verifying NZ tax data for the tax year ending 31 March ${taxYear}.

Check: ${areaDescription}
Current stored value: ${currentDisplay}

Search the official NZ government websites (ird.govt.nz, employment.govt.nz, legislation.govt.nz) for the current authoritative value for the ${taxYear} tax year.

Respond in JSON only, no markdown formatting:
{
  "verified_value": "the value you found, formatted the same way as the current stored value",
  "status": "current" if the stored value matches what you found, "changed" if different, "uncertain" if you couldn't confirm,
  "source_url": "URL where you found this information",
  "notes": "brief explanation, especially if changed or uncertain"
}`;

  let messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: prompt }];
  let responseText = "";
  let iterations = 0;

  // Loop to handle web search tool use (server-side tool may require continuation)
  while (iterations < 3) {
    iterations++;
    const response = await getClient().messages.create({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 1024,
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: 3,
        } as unknown as Anthropic.Messages.Tool,
      ],
      messages,
    });

    // Extract text from response
    for (const block of response.content) {
      if (block.type === "text") {
        responseText += block.text;
      }
    }

    // If stop reason is end_turn or we got text, we're done
    if (response.stop_reason === "end_turn" || responseText.includes("{")) {
      break;
    }

    // If tool_use, add assistant response and continue
    if (response.stop_reason === "tool_use") {
      messages = [
        ...messages,
        { role: "assistant", content: response.content },
        { role: "user", content: "Please provide the JSON result." },
      ];
      continue;
    }

    break;
  }

  // Parse JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return {
      verified_value: "",
      status: "uncertain",
      source_url: "",
      notes: "Could not parse verification response",
    };
  }

  try {
    return JSON.parse(jsonMatch[0]) as VerifyAreaResult;
  } catch {
    return {
      verified_value: "",
      status: "uncertain",
      source_url: "",
      notes: "Failed to parse JSON response",
    };
  }
}

export async function runRegulatoryCheck(taxYear?: number): Promise<string> {
  const db = getDb();
  const year = taxYear ?? getNzTaxYear(new Date());
  const runId = uuid();

  // Create the run record
  db.insert(schema.regulatoryCheckRuns)
    .values({
      id: runId,
      tax_year: year,
      status: "running",
    })
    .run();

  const currentValues = getCurrentValues(year);
  let areasChecked = 0;
  let areasChanged = 0;
  let areasUncertain = 0;

  for (const area of REGULATORY_AREAS) {
    const current = currentValues[area.id];
    if (!current) continue;

    let result: VerifyAreaResult;
    try {
      result = await verifyArea(
        area.id,
        area.label,
        area.description,
        current.display,
        year
      );
    } catch (err) {
      result = {
        verified_value: "",
        status: "uncertain",
        source_url: "",
        notes: `Error: ${err instanceof Error ? err.message : "Unknown error"}`,
      };
    }

    const status = result.status === "changed" ? "changed"
      : result.status === "uncertain" ? "uncertain"
      : "current";

    if (status === "changed") areasChanged++;
    if (status === "uncertain") areasUncertain++;
    areasChecked++;

    db.insert(schema.regulatoryChecks)
      .values({
        id: uuid(),
        run_id: runId,
        tax_year: year,
        area: area.id,
        current_value: JSON.stringify(current.value),
        verified_value: result.verified_value || null,
        status,
        source_url: result.source_url || null,
        notes: result.notes || null,
        applied: false,
      })
      .run();
  }

  // Mark run as completed
  db.update(schema.regulatoryCheckRuns)
    .set({
      status: "completed",
      areas_checked: areasChecked,
      areas_changed: areasChanged,
      areas_uncertain: areasUncertain,
      completed_at: new Date(),
    })
    .where(eq(schema.regulatoryCheckRuns.id, runId))
    .run();

  return runId;
}

export function getLatestCheckRun() {
  const db = getDb();
  return db
    .select()
    .from(schema.regulatoryCheckRuns)
    .orderBy(desc(schema.regulatoryCheckRuns.started_at))
    .limit(1)
    .get() ?? null;
}

export function getCheckResults(runId: string) {
  const db = getDb();
  return db
    .select()
    .from(schema.regulatoryChecks)
    .where(eq(schema.regulatoryChecks.run_id, runId))
    .all();
}

export function getUnappliedChangesCount(): number {
  const db = getDb();
  const latestRun = getLatestCheckRun();
  if (!latestRun) return 0;

  return db
    .select()
    .from(schema.regulatoryChecks)
    .where(
      and(
        eq(schema.regulatoryChecks.run_id, latestRun.id),
        eq(schema.regulatoryChecks.applied, false)
      )
    )
    .all()
    .filter((c) => c.status === "changed" || c.status === "uncertain")
    .length;
}
