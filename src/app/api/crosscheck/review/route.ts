import { NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { runAiReview } from "@/lib/crosscheck/ai-review";

export async function POST() {
  const session = await getSession();
  if (!session || !session.activeBusiness) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const businessId = session.activeBusiness.id;

  try {
    const result = await runAiReview(businessId);

    // Store AI-generated anomalies
    const db = getDb();
    for (const concern of result.concerns) {
      db.insert(schema.anomalies)
        .values({
          id: uuid(),
          business_id: businessId,
          severity: concern.severity,
          category: concern.category,
          title: concern.title,
          description: concern.description,
          entity_type: "cross_entity",
          entity_id: concern.entity_id,
          suggested_question: concern.suggested_question,
          status: "new",
        })
        .run();
    }

    return NextResponse.json({
      success: true,
      overall_level: result.overall_level,
      summary: result.summary,
      new_concerns: result.concerns.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "AI review failed" },
      { status: 500 }
    );
  }
}
