import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const PROTECTED_PREFIXES = ["/admin", "/host"];
const API_PROTECTED_PATTERNS = [
  /^\/api\/live-sessions\/[^/]+\/(start|end|replay)\/?$/,
  /^\/api\/live-sessions\/[^/]+\/comments\/[^/]+\/(approve|reject|pin|mark-question)\/?$/,
  /^\/api\/live-sessions\/[^/]+\/mic-requests\/[^/]+\/(approve|reject)\/?$/,
  /^\/api\/live-sessions\/[^/]+\/participants\/[^/]+\/(kick|mute|unmute)\/?$/,
  /^\/api\/live-sessions\/[^/]+\/leads\/[^/]+\/?$/,
];

function hasSessionCookie(request: NextRequest) {
  return Boolean(
    request.cookies.get("authjs.session-token")?.value ??
    request.cookies.get("__Secure-authjs.session-token")?.value,
  );
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  const isProtectedPage = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  const isProtectedApi = API_PROTECTED_PATTERNS.some((pattern) => pattern.test(pathname));

  if ((isProtectedPage || isProtectedApi) && !hasSessionCookie(request)) {
    if (isProtectedApi) {
      return Response.json({ ok: false, error: "AUTH_REQUIRED" }, { status: 401 });
    }

    const signInUrl = new URL("/api/auth/signin", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/host/:path*", "/api/live-sessions/:path*"],
};
