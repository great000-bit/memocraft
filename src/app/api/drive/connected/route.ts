import { after } from "next/server";
import { NextResponse } from "next/server";
import { auth, pool } from "@/lib/auth";
import { enableBackup, hasDriveScope, runDriveBackup } from "@/lib/drive";

// Google sends people here after the Drive permission step. If they ticked the Drive box we now hold the
// permission, so the backup is switched on; if they unticked it on Google's screen we say so and change nothing.
const destinations = new Set(["/dashboard", "/settings"]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asked = url.searchParams.get("to") ?? "/dashboard";
  const to = destinations.has(asked) ? asked : "/dashboard";
  // "connect" always lands in Settings, where the permission can be granted.
  const back = (flag: string) => NextResponse.redirect(new URL(`${flag === "connect" ? "/settings" : to}?drive=${flag}`, url));

  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session) return NextResponse.redirect(new URL("/login", url));

  const { rows } = await pool.query<{ scope: string | null; fresh: boolean }>(
    `select "scope", "createdAt" > now() - interval '5 minutes' as fresh from "account" where "userId" = $1 and "providerId" = 'google' limit 1`,
    [session.user.id],
  );
  if (!hasDriveScope(rows[0]?.scope)) {
    // A normal sign-in does not record new permissions, only linking does. So someone who ticked the box while
    // signing in to an existing account is sent to Settings to grant it there. A brand new account already went
    // through Google's screen, so a missing permission means they unticked it.
    if (url.searchParams.get("from") === "signin" && !rows[0]?.fresh) return back("connect");
    return back("declined");
  }

  await enableBackup(session.user.id);
  after(() => runDriveBackup(session.user.id));
  return back("on");
}
