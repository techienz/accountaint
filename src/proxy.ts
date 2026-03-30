import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/setup", "/api/auth/", "/_next/", "/favicon.ico"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Allow service worker
  if (pathname === "/sw.js") {
    return NextResponse.next();
  }

  const token = request.cookies.get("session")?.value;

  // Check if user has a valid session (lightweight JWT check only in middleware)
  let hasSession = false;
  if (token) {
    try {
      const secret = process.env.JWT_SECRET;
      if (secret && secret.length >= 32) {
        await jwtVerify(token, new TextEncoder().encode(secret));
        hasSession = true;
      }
    } catch {
      // Invalid/expired token
    }
  }

  if (!hasSession) {
    // Redirect to login (or setup if first run — setup page will handle this)
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
