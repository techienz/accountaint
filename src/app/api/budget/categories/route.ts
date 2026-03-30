import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { listCategories, seedDefaultCategories } from "@/lib/budget";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  seedDefaultCategories(session.user.id);
  return NextResponse.json(listCategories(session.user.id));
}
