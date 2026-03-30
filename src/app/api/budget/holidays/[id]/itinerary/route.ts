import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getHoliday } from "@/lib/budget";
import { localComplete } from "@/lib/lmstudio/llm";
import { LmStudioUnavailableError } from "@/lib/lmstudio/embeddings";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const holiday = getHoliday(id, session.user.id);
  if (!holiday)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const interests = body.interests ?? "";
  const days = body.days ?? 7;

  const totalBudget =
    holiday.accommodation_cost +
    holiday.travel_cost +
    holiday.spending_budget +
    holiday.other_costs;

  const budgetBreakdown = [
    `Accommodation: $${holiday.accommodation_cost}`,
    `Travel: $${holiday.travel_cost}`,
    `Spending: $${holiday.spending_budget}`,
    `Other: $${holiday.other_costs}`,
  ].join(", ");

  const system = `You are a travel itinerary planner. Generate practical, day-by-day itineraries with specific activity suggestions, restaurant recommendations, and transport tips. Keep suggestions realistic and budget-appropriate. Format clearly with day headers and bullet points.`;

  const prompt = `Create a ${days}-day itinerary for ${holiday.destination}.

Trip type: ${holiday.trip_type}
${holiday.date ? `Date: ${holiday.date}` : ""}
Total budget: $${totalBudget} NZD (${budgetBreakdown})
${interests ? `Interests: ${interests}` : ""}

For each day include:
- Morning, afternoon, and evening activities
- Restaurant or food suggestions
- Estimated costs where relevant
- Transport tips between locations

Keep it practical and within the budget. Use local knowledge where possible.`;

  try {
    const itinerary = await localComplete({
      system,
      prompt,
      maxTokens: 2048,
    });

    return NextResponse.json({ itinerary });
  } catch (e) {
    if (e instanceof LmStudioUnavailableError) {
      return NextResponse.json(
        {
          error:
            "Local LLM (LM Studio) is not available. Start LM Studio to generate itineraries.",
        },
        { status: 503 }
      );
    }
    return NextResponse.json(
      { error: "Failed to generate itinerary" },
      { status: 500 }
    );
  }
}
