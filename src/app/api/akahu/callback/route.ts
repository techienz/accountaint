import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import { parseState, exchangeCodeForTokens } from "@/lib/akahu/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle Akahu-side errors
  if (error) {
    const errorUrl = new URL("/settings/bank-feeds", request.url);
    errorUrl.searchParams.set("error", "akahu_denied");
    return NextResponse.redirect(errorUrl);
  }

  if (!code || !state) {
    const errorUrl = new URL("/settings/bank-feeds", request.url);
    errorUrl.searchParams.set("error", "missing_params");
    return NextResponse.redirect(errorUrl);
  }

  // Validate state param
  const parsed = parseState(state);
  if (!parsed) {
    const errorUrl = new URL("/settings/bank-feeds", request.url);
    errorUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(errorUrl);
  }

  // Validate CSRF nonce
  const cookieStore = await cookies();
  const storedNonce = cookieStore.get("akahu_nonce")?.value;
  cookieStore.delete("akahu_nonce");

  if (!storedNonce || storedNonce !== parsed.nonce) {
    const errorUrl = new URL("/settings/bank-feeds", request.url);
    errorUrl.searchParams.set("error", "csrf_mismatch");
    return NextResponse.redirect(errorUrl);
  }

  // Verify the user matches
  if (session.user.id !== parsed.userId) {
    const errorUrl = new URL("/settings/bank-feeds", request.url);
    errorUrl.searchParams.set("error", "user_mismatch");
    return NextResponse.redirect(errorUrl);
  }

  try {
    const tokens = await exchangeCodeForTokens(code);

    const db = getDb();
    const userId = session.user.id;

    // Upsert: delete existing connection for this user, then insert
    db.delete(schema.akahuConnections)
      .where(eq(schema.akahuConnections.user_id, userId))
      .run();

    db.insert(schema.akahuConnections)
      .values({
        id: uuid(),
        user_id: userId,
        access_token: encrypt(tokens.access_token),
      })
      .run();

    return NextResponse.redirect(
      new URL("/settings/bank-feeds?connected=true", request.url)
    );
  } catch (err) {
    console.error(
      "Akahu callback error:",
      err instanceof Error ? err.message : err
    );
    const errorUrl = new URL("/settings/bank-feeds", request.url);
    errorUrl.searchParams.set("error", "token_exchange");
    return NextResponse.redirect(errorUrl);
  }
}
