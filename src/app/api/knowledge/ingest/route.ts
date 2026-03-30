import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import {
  ingestAllGuides,
  ingestExistingMarkdown,
  ingestManualPdfs,
} from "@/lib/knowledge/ingest";

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const mode = body.mode as string;

  try {
    let count: number;

    switch (mode) {
      case "seed":
        count = await ingestExistingMarkdown();
        break;
      case "all":
        count = await ingestAllGuides();
        break;
      case "manual":
        count = await ingestManualPdfs();
        break;
      default:
        return NextResponse.json(
          { error: "Invalid mode. Use 'seed', 'all', or 'manual'." },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, chunksIngested: count });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("[api/knowledge/ingest] Error:", msg, error);
    return NextResponse.json(
      { error: `Ingestion failed: ${msg}` },
      { status: 500 }
    );
  }
}
