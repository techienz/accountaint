import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ messages: [] });
  }

  const db = getDb();
  const messages = db
    .select({
      id: schema.chatMessages.id,
      role: schema.chatMessages.role,
      content: schema.chatMessages.content,
      created_at: schema.chatMessages.created_at,
    })
    .from(schema.chatMessages)
    .where(eq(schema.chatMessages.business_id, business.id))
    .orderBy(desc(schema.chatMessages.created_at))
    .limit(50)
    .all()
    .reverse();

  return NextResponse.json({ messages });
}
