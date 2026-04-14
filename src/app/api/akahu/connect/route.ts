import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSession } from "@/lib/auth";
import { getAuthUrl } from "@/lib/akahu/auth";

/**
 * GET: Redirect to Akahu OAuth2 authorization page.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url, nonce } = getAuthUrl(session.user.id);

  const cookieStore = await cookies();
  cookieStore.set("akahu_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.redirect(url);
}

/**
 * POST: Programmatic connect — returns auth URL for client-side redirect.
 */
export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { url, nonce } = getAuthUrl(session.user.id);

  const cookieStore = await cookies();
  cookieStore.set("akahu_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.json({ url });
}
