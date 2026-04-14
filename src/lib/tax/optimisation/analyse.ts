import Anthropic from "@anthropic-ai/sdk";
import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";
import { getNzTaxYear } from "@/lib/tax/rules";
import { gatherOptimisationSnapshot } from "./gather";
import type { OptimisationSnapshot, TaxRecommendation } from "./types";

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (client) return client;
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY required");
  }
  client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const ANALYSIS_PROMPT = `You are an aggressive NZ tax optimiser analysing a business's financial data to find every legal way to reduce their tax burden.

Here is the business's current financial snapshot:
{SNAPSHOT}

Analyse this data and identify ALL applicable tax optimisation strategies. For each opportunity:
1. Compare what they're currently doing vs what they should do instead
2. Calculate the specific dollar saving based on their actual numbers
3. Rate the risk level: "safe" (standard practice), "moderate" (legal but may attract IRD attention), or "aggressive" (grey area, explicitly legal but IRD may challenge)
4. Reference the specific IRD guide, section, or Revenue Alert that supports it
5. Classify the action: "auto" if the app could do it (change salary config, switch calculator method), "reminder" if the user needs to take external action (pre-pay a bill, time an invoice), "info" if it's just awareness

Consider these categories:
- Salary/dividend split optimisation (NZ company rate 28% vs personal brackets)
- Home office claim method (proportional vs square metre rate)
- Vehicle claim method (mileage rate vs actual cost with logbook)
- Low-value asset write-off ($1,000 threshold) and asset splitting
- Investment Boost (20% immediate deduction on new assets over $1,000)
- Expense prepayment before balance date
- Income timing around balance date (invoice deferral)
- KiwiSaver employer contributions and ESCT bracket optimisation
- Provisional tax method selection (standard vs estimation vs AIM)
- GST basis and filing period optimisation
- ACC levy and CU code review
- Shareholder current account management (prescribed interest, deemed dividends)
- Charitable donation routing (company deduction vs personal tax credit)
- Any other NZ-specific strategy you identify

Be aggressive. Present strategies most accountants wouldn't bother with. Include grey areas with honest risk assessment. The user is a capable adult making informed decisions.

Respond with ONLY a JSON array of recommendations, no markdown. Each object must have these exact fields:
{
  "id": "unique-string",
  "strategy": "Strategy Name",
  "currentApproach": "What they're doing now",
  "optimisedApproach": "What they should do instead",
  "annualSaving": 1234.56,
  "riskLevel": "safe" | "moderate" | "aggressive",
  "riskNote": "IRD rule or risk explanation" | null,
  "actionType": "auto" | "reminder" | "info",
  "actionDetails": "Specific steps to take",
  "irdReference": "IR guide or section" | null
}

Sort by annualSaving descending (highest first).`;

export async function runTaxOptimisationAnalysis(businessId: string): Promise<{
  recommendations: TaxRecommendation[];
  snapshot: OptimisationSnapshot;
  resultId: string;
}> {
  const snapshot = gatherOptimisationSnapshot(businessId);
  const prompt = ANALYSIS_PROMPT.replace("{SNAPSHOT}", JSON.stringify(snapshot, null, 2));

  const response = await getClient().messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    max_tokens: 8192,
    tools: [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5,
      } as unknown as Anthropic.Messages.Tool,
    ],
    messages: [{ role: "user", content: prompt }],
  });

  // Extract text from response (may include web search blocks)
  let responseText = "";
  for (const block of response.content) {
    if (block.type === "text") {
      responseText += block.text;
    }
  }

  // Parse JSON array from response
  let recommendations: TaxRecommendation[] = [];
  const jsonMatch = responseText.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      recommendations = Array.isArray(parsed) ? parsed : [];
    } catch {
      recommendations = [];
    }
  }

  // Ensure IDs exist
  for (const rec of recommendations) {
    if (!rec.id) rec.id = uuid();
  }

  const totalSaving = recommendations.reduce((sum, r) => sum + (r.annualSaving || 0), 0);

  // Save results
  const db = getDb();
  const resultId = uuid();
  db.insert(schema.taxOptimisationResults)
    .values({
      id: resultId,
      business_id: businessId,
      tax_year: snapshot.taxYear,
      snapshot: JSON.stringify(snapshot),
      recommendations: JSON.stringify(recommendations),
      total_potential_saving: Math.round(totalSaving * 100) / 100,
      opportunity_count: recommendations.length,
    })
    .run();

  return { recommendations, snapshot, resultId };
}

export function getLatestOptimisationResults(businessId: string) {
  const db = getDb();
  const result = db
    .select()
    .from(schema.taxOptimisationResults)
    .where(eq(schema.taxOptimisationResults.business_id, businessId))
    .orderBy(desc(schema.taxOptimisationResults.scanned_at))
    .limit(1)
    .get();

  if (!result) return null;

  return {
    ...result,
    recommendations: JSON.parse(result.recommendations) as TaxRecommendation[],
    snapshot: JSON.parse(result.snapshot) as OptimisationSnapshot,
  };
}

export function getOptimisationSummary(businessId: string): {
  totalPotentialSaving: number;
  opportunityCount: number;
  lastScanned: Date | null;
} {
  const result = getLatestOptimisationResults(businessId);
  if (!result) {
    return { totalPotentialSaving: 0, opportunityCount: 0, lastScanned: null };
  }
  return {
    totalPotentialSaving: result.total_potential_saving,
    opportunityCount: result.opportunity_count,
    lastScanned: result.scanned_at,
  };
}
