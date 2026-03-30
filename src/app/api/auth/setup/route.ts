import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { getDb, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { hashPassword, createSession, hasUsers } from "@/lib/auth";

export async function GET() {
  return NextResponse.json({ needsSetup: !hasUsers() });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { name, email, password } = body;

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "All fields are required" },
      { status: 400 }
    );
  }

  if (!/^\d{4}$/.test(password)) {
    return NextResponse.json(
      { error: "PIN must be exactly 4 digits" },
      { status: 400 }
    );
  }

  const db = getDb();

  // Check if email already taken
  const existing = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, email.toLowerCase().trim()))
    .get();
  if (existing) {
    return NextResponse.json(
      { error: "An account with this email already exists. Go back to login." },
      { status: 409 }
    );
  }

  const userId = uuid();

  db.insert(schema.users)
    .values({
      id: userId,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password_hash: hashPassword(password),
    })
    .run();

  await createSession(userId);

  return NextResponse.json({ success: true });
}
