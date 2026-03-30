import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { v4 as uuid } from "uuid";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { encrypt } from "@/lib/crypto";
import {
  getAuthUrl,
  isCustomConnection,
  getClientCredentialsToken,
  getConnectedTenants,
} from "@/lib/xero/auth";

/**
 * GET: Initiate Xero connection.
 * - Custom connection: fetches token directly via client_credentials, no redirect
 * - Web app: redirects to Xero OAuth2 authorize page
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.activeBusiness) {
    return NextResponse.json(
      { error: "No active business selected" },
      { status: 400 }
    );
  }

  // Custom connection: no redirect needed
  if (isCustomConnection()) {
    try {
      const tokens = await getClientCredentialsToken();
      const tenants = await getConnectedTenants(tokens.access_token);

      if (tenants.length === 0) {
        return NextResponse.json(
          { error: "No organisations connected to this Xero app" },
          { status: 400 }
        );
      }

      const tenant = tenants[0];
      const db = getDb();
      const businessId = session.activeBusiness.id;

      // Upsert connection
      db.delete(schema.xeroConnections)
        .where(eq(schema.xeroConnections.business_id, businessId))
        .run();

      db.insert(schema.xeroConnections)
        .values({
          id: uuid(),
          business_id: businessId,
          tenant_id: tenant.tenantId,
          tenant_name: tenant.tenantName,
          access_token: encrypt(tokens.access_token),
          refresh_token: encrypt(""), // no refresh token for client_credentials
          token_expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ),
          scopes: tokens.scope || "",
        })
        .run();

      return NextResponse.redirect(
        new URL("/settings/xero?connected=true", process.env.XERO_REDIRECT_URI || "http://localhost:3020")
      );
    } catch (err) {
      console.error("Xero custom connection error:", err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Connection failed" },
        { status: 500 }
      );
    }
  }

  // Web app flow: redirect to Xero
  const { url, nonce } = getAuthUrl(session.activeBusiness.id);

  const cookieStore = await cookies();
  cookieStore.set("xero_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });

  return NextResponse.redirect(url);
}

/**
 * POST: Programmatic connect (e.g. from onboarding wizard).
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!session.activeBusiness) {
    return NextResponse.json(
      { error: "No active business selected" },
      { status: 400 }
    );
  }

  // Custom connection: connect directly
  if (isCustomConnection()) {
    try {
      const tokens = await getClientCredentialsToken();
      const tenants = await getConnectedTenants(tokens.access_token);

      if (tenants.length === 0) {
        return NextResponse.json(
          { error: "No organisations connected to this Xero app" },
          { status: 400 }
        );
      }

      const tenant = tenants[0];
      const db = getDb();
      const businessId = session.activeBusiness.id;

      db.delete(schema.xeroConnections)
        .where(eq(schema.xeroConnections.business_id, businessId))
        .run();

      db.insert(schema.xeroConnections)
        .values({
          id: uuid(),
          business_id: businessId,
          tenant_id: tenant.tenantId,
          tenant_name: tenant.tenantName,
          access_token: encrypt(tokens.access_token),
          refresh_token: encrypt(""),
          token_expires_at: new Date(
            Date.now() + tokens.expires_in * 1000
          ),
          scopes: tokens.scope || "",
        })
        .run();

      return NextResponse.json({
        connected: true,
        tenantName: tenant.tenantName,
      });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Connection failed" },
        { status: 500 }
      );
    }
  }

  // Web app flow: return auth URL
  const { url, nonce } = getAuthUrl(session.activeBusiness.id);

  const cookieStore = await cookies();
  cookieStore.set("xero_nonce", nonce, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
    secure: process.env.NODE_ENV === "production",
  });

  const from = request.nextUrl.searchParams.get("from");
  if (from) {
    cookieStore.set("xero_return", from, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
      secure: process.env.NODE_ENV === "production",
    });
  }

  return NextResponse.json({ url });
}
