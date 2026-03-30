import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import {
  parseState,
  exchangeCodeForTokens,
  getConnectedTenants,
} from "@/lib/xero/auth";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  // Handle Xero-side errors
  if (error) {
    const errorUrl = new URL("/settings/xero", request.url);
    errorUrl.searchParams.set("error", "xero_denied");
    return NextResponse.redirect(errorUrl);
  }

  if (!code || !state) {
    const errorUrl = new URL("/settings/xero", request.url);
    errorUrl.searchParams.set("error", "missing_params");
    return NextResponse.redirect(errorUrl);
  }

  // Validate state param
  const parsed = parseState(state);
  if (!parsed) {
    const errorUrl = new URL("/settings/xero", request.url);
    errorUrl.searchParams.set("error", "invalid_state");
    return NextResponse.redirect(errorUrl);
  }

  // Validate CSRF nonce
  const cookieStore = await cookies();
  const storedNonce = cookieStore.get("xero_nonce")?.value;
  cookieStore.delete("xero_nonce");

  if (!storedNonce || storedNonce !== parsed.nonce) {
    const errorUrl = new URL("/settings/xero", request.url);
    errorUrl.searchParams.set("error", "csrf_mismatch");
    return NextResponse.redirect(errorUrl);
  }

  // Verify the business belongs to this user
  const { businessId } = parsed;
  if (
    !session.activeBusiness ||
    session.activeBusiness.id !== businessId
  ) {
    const errorUrl = new URL("/settings/xero", request.url);
    errorUrl.searchParams.set("error", "business_mismatch");
    return NextResponse.redirect(errorUrl);
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get connected tenants
    const tenants = await getConnectedTenants(tokens.access_token);
    if (tenants.length === 0) {
      const errorUrl = new URL("/settings/xero", request.url);
      errorUrl.searchParams.set("error", "no_tenants");
      return NextResponse.redirect(errorUrl);
    }

    // Use the first tenant (most common case for small businesses)
    const tenant = tenants[0];

    // Encrypt tokens before storage
    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = encrypt(tokens.refresh_token);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const db = getDb();

    // Upsert: delete existing connection for this business, then insert
    db.delete(schema.xeroConnections)
      .where(eq(schema.xeroConnections.business_id, businessId))
      .run();

    db.insert(schema.xeroConnections)
      .values({
        id: uuid(),
        business_id: businessId,
        tenant_id: tenant.tenantId,
        tenant_name: tenant.tenantName,
        access_token: encryptedAccessToken,
        refresh_token: encryptedRefreshToken,
        token_expires_at: expiresAt,
        scopes: tokens.scope,
      })
      .run();

    // Check if we should return to onboarding
    const returnTo = cookieStore.get("xero_return")?.value;
    cookieStore.delete("xero_return");

    if (returnTo === "onboarding") {
      return NextResponse.redirect(
        new URL("/onboarding?step=9&connected=true", request.url)
      );
    }

    return NextResponse.redirect(
      new URL("/settings/xero?connected=true", request.url)
    );
  } catch (err) {
    console.error(
      "Xero callback error:",
      err instanceof Error ? err.message : err
    );
    const errorUrl = new URL("/settings/xero", request.url);
    errorUrl.searchParams.set("error", "token_exchange");
    return NextResponse.redirect(errorUrl);
  }
}
