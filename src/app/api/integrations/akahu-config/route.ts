import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getIntegrationConfigs, setIntegrationConfig, isIntegrationConfigured } from "@/lib/integrations/config";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const configured = isIntegrationConfigured("akahu", ["app_token", "user_token"]);
  const configs = getIntegrationConfigs("akahu");

  return NextResponse.json({
    configured,
    hasAppToken: !!configs.app_token,
    hasUserToken: !!configs.user_token,
  });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { app_token, user_token, app_secret, redirect_uri } = body;

  if (app_token) setIntegrationConfig("akahu", "app_token", app_token);
  if (user_token) setIntegrationConfig("akahu", "user_token", user_token);
  // Legacy support for OAuth apps
  if (app_secret) setIntegrationConfig("akahu", "app_secret", app_secret);
  if (redirect_uri) setIntegrationConfig("akahu", "redirect_uri", redirect_uri);

  return NextResponse.json({ success: true });
}
