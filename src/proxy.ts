import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// The admin console answers "page not found" to anyone who is not an admin, before a byte of it is sent. Its pages
// stream, so the check has to happen here, where the status code can still be 404. The session lookup is loaded only
// for /admin, so the workspace pages that pass through here carry none of its weight.
async function adminGate(request: NextRequest) {
  const notFound = NextResponse.rewrite(new URL("/admin-not-found", request.url), { status: 404 });
  if (!getSessionCookie(request, { cookiePrefix: "memocraft" })) return notFound;
  const [{ auth }, { isAdmin }] = await Promise.all([import("@/lib/auth"), import("@/lib/admin-check")]);
  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  return session && isAdmin(session.user) ? NextResponse.next() : notFound;
}

// Quick check before rendering: no session cookie means no workspace. Each page still verifies the
// session itself, because a cookie alone proves nothing.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === "/admin" || request.nextUrl.pathname.startsWith("/admin/")) return adminGate(request);
  if (!getSessionCookie(request, { cookiePrefix: "memocraft" })) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/deliveries/:path*",
    "/requests/:path*",
    "/enhancer/:path*",
    "/notifications/:path*",
    "/profile/:path*",
    "/settings/:path*",
    "/admin",
    "/admin/:path*",
  ],
};
