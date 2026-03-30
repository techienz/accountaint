import { NextRequest, NextResponse } from "next/server";
import { login } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { email, password } = body;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and PIN are required" },
      { status: 400 }
    );
  }

  const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const result = await login(email, password, ip);

  if (!result.success) {
    return NextResponse.json({ error: result.error }, { status: 401 });
  }

  return NextResponse.json({ success: true });
}
