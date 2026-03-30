import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { shareholders } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { encrypt, decrypt } from "@/lib/encryption";
import { validateIrdNumber } from "@/lib/tax/ird-validator";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const db = getDb();
  const rows = await db
    .select()
    .from(shareholders)
    .where(eq(shareholders.business_id, business.id));

  const decrypted = rows.map((s) => ({
    ...s,
    name: decrypt(s.name),
    ird_number: s.ird_number ? decrypt(s.ird_number) : null,
  }));

  return NextResponse.json(decrypted);
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const business = session.activeBusiness;
  if (!business) {
    return NextResponse.json({ error: "No active business" }, { status: 400 });
  }

  const body = await request.json();
  const { name, ird_number, ownership_percentage, is_director } = body;

  if (!name || ownership_percentage == null) {
    return NextResponse.json(
      { error: "Name and ownership percentage are required" },
      { status: 400 }
    );
  }

  if (ird_number) {
    const irdResult = validateIrdNumber(ird_number);
    if (!irdResult.valid) {
      return NextResponse.json({ error: irdResult.error }, { status: 400 });
    }
  }

  const db = getDb();
  const id = crypto.randomUUID();

  await db.insert(shareholders).values({
    id,
    business_id: business.id,
    name: encrypt(name),
    ird_number: ird_number ? encrypt(ird_number) : null,
    ownership_percentage,
    is_director: is_director ?? false,
  });

  return NextResponse.json({ id }, { status: 201 });
}
