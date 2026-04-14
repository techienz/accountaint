import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { checkLmStudioHealth } from "@/lib/lmstudio/client";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const available = await checkLmStudioHealth();
  return NextResponse.json({ available });
}
