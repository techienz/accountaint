import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getKnowledgeStatus } from "@/lib/knowledge/status";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const status = await getKnowledgeStatus();
    return NextResponse.json(status);
  } catch (error) {
    console.error("[api/knowledge/status] Error:", error);
    return NextResponse.json(
      { error: "Failed to get knowledge status" },
      { status: 500 }
    );
  }
}
