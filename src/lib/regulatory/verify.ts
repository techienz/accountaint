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
  as_at_date?: string;
  notes: string;
};

async function verifyArea(
  areaId: string,
  areaLabel: string,
  areaDescription: string,
  currentDisplay: string,
  taxYear: number,
  canonicalSources: string[] | undefined
): Promise<VerifyAreaResult> {
  const yearStart = `1 April ${taxYear - 1}`;
  const yearEnd = `31 March ${taxYear}`;

  const sourcesBlock =
    canonicalSources && canonicalSources.length > 0
      ? `Authoritative source(s) — consult these FIRST:
${canonicalSources.map((u) => `- ${u}`).join("\n")}
Only fall back to general search if these specific URLs do not load or do not cover the requested rate.`
      : `Search official NZ government sources only: ird.govt.nz, employment.govt.nz, legislation.govt.nz, acc.co.nz.`;

  const prompt = `You are verifying NZ tax data for the New Zealand tax year ${taxYear}, which covers ${yearStart} to ${yearEnd}.

Verifying: ${areaLabel}
Description: ${areaDescription}
Currently stored value: ${currentDisplay}

CRITICAL INSTRUCTIONS — read carefully:

1. **NZ tax-year naming convention**: "tax year ${taxYear}" means the period ${yearStart} → ${yearEnd}. NOT calendar year ${taxYear}. The rate applicable to this period is what you must find.

2. **Do NOT rely on prior knowledge.** Use only what you can find in *current* published sources. Several NZ tax rates were updated in 2024 (e.g. personal income tax thresholds changed effective 31 July 2024; trustee tax rate to 39%). Prior-knowledge values may be stale.

3. **Source must be current.** The page you cite must either:
   (a) explicitly state an "as at" / "effective from" / "applies from" date that covers ${yearStart} to ${yearEnd}, OR
   (b) explicitly state "no changes for ${taxYear - 1}/${taxYear}" or similar.
   If neither is present, return status="uncertain" — do NOT guess from training data.

4. **If sources disagree**, prefer the most recent IRD/MBIE/legislation.govt.nz page that explicitly covers the requested tax year.

5. **Don't regress to old values.** If you find both a current and a historical bracket set on the same page, return the current one. Mention any superseded set in notes.

${sourcesBlock}

Respond in JSON only, no markdown formatting:
{
  "verified_value": "the value you found, formatted the same way as the current stored value",
  "status": "current" if the stored value matches what you found, "changed" if different, "uncertain" if you couldn't confirm with the currency-evidence requirements above,
  "source_url": "specific URL where you found this — must be a page with an as-at or effective-from date",
  "as_at_date": "the as-at / effective-from / publish date shown on that source (YYYY-MM-DD if possible, otherwise as quoted)",
  "notes": "brief explanation. If status='changed', explain why the stored value is wrong and which date the change took effect. If 'uncertain', explain what you couldn't confirm."
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
        year,
        area.canonicalSources
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

    // Fold as_at_date into notes so it's surfaced without a schema migration.
    const combinedNotes = result.as_at_date
      ? `[Source as at: ${result.as_at_date}] ${result.notes ?? ""}`.trim()
      : result.notes || null;

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
        notes: combinedNotes,
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
