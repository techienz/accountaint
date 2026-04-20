import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC_PATHS = ["/login", "/setup", "/api/auth/", "/api/health", "/_next/", "/favicon.ico"];
const PUBLIC_STATIC_PATTERNS = [
  /^\/manifest\.json$/,
  /^\/icon-\d+\.png$/,
  /^\/icon\.svg$/,
  /^\/apple-touch-icon\.png$/,
  /^\/[a-z]+-touch-icon\.png$/,
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) return true;
  return PUBLIC_STATIC_PATTERNS.some((re) => re.test(pathname));
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
