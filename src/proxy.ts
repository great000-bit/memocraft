import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Quick check before rendering: no session cookie means no workspace. Each page still verifies the
// session itself, because a cookie alone proves nothing.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request, { cookiePrefix: "memocraft" })) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/deliveries/:path*", "/requests/:path*", "/profile/:path*", "/settings/:path*"],
};
