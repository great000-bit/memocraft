import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";
import { isAppHost } from "@/lib/hosts";

const workspace = /^\/(dashboard|deliveries|requests|notifications|profile|settings)(\/|$)/;

// On a creative's own address only client links and what they load are served: no sign-in, no workspace, no
// marketing pages. Everything else there is "not found".
const clientPaths = /^\/(d\/|_next\/|api\/domain-check$|icon\.svg$|favicon\.ico$|manifest\.webmanifest$|icons\/|images\/)/;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (!isAppHost(request.headers.get("host"))) {
    if (clientPaths.test(pathname)) return NextResponse.next();
    return new NextResponse("Not found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  // Quick check before rendering: no session cookie means no workspace. Each page still verifies the
  // session itself, because a cookie alone proves nothing.
  if (workspace.test(pathname) && !getSessionCookie(request, { cookiePrefix: "memocraft" })) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
