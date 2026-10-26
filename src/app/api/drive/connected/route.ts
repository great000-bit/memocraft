import { after } from "next/server";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { driveGrant, enableBackup, hasDriveScope, recordNoBackup, runDriveBackup } from "@/lib/drive";

// Every sign-in lands here. Google has just shown the Drive permission, so this decides what happens next:
//  - permission and refresh token held: the backup is switched on (unless the person turned it off before);
//  - person said no on Google's screen: remember it and carry on, the app works without the backup;
//  - an older account that has not granted it yet: carries on to the dashboard; the Settings card offers it.
// A normal sign-in does not record new permissions on an existing account, only linking does, which is why
// older accounts have to use the Settings card.
const destinations = new Set(["/dashboard", "/settings"]);
// A team invite brings people back to its own page to accept it.
const invitePage = /^\/join\/[A-Za-z0-9_-]{43}$/;

export async function GET(request: Request) {
  const url = new URL(request.url);
  const asked = url.searchParams.get("to") ?? "/dashboard";
  const to = destinations.has(asked) || invitePage.test(asked) ? asked : "/dashboard";
  const from = url.searchParams.get("from");
  const go = (path: string, flag?: string) => NextResponse.redirect(new URL(flag ? `${path}?drive=${flag}` : path, url));

  const session = await auth.api.getSession({ headers: request.headers }).catch(() => null);
  if (!session) return NextResponse.redirect(new URL("/login", url));
  const userId = session.user.id;

  const grant = await driveGrant(userId);
  const granted = hasDriveScope(grant.scope) && grant.hasRefresh;

  if (granted) {
    // Someone who turned the backup off keeps it off, unless they pressed the button in Settings.
    if (grant.backupEnabled === false && from === "signin") return go(to);
    await enableBackup(userId);
    after(() => runDriveBackup(userId));
    return go(to, from === "link" ? "on" : undefined);
  }

  if (from === "link") {
    // They went through the Settings button and still did not give it.
    await recordNoBackup(userId);
    return go("/settings", "declined");
  }
  if (grant.backupEnabled !== null) return go(to);
  if (grant.fresh) {
    // A brand new account saw Google's screen with Drive on it and unticked it.
    await recordNoBackup(userId);
    return go(to);
  }
  // An older account that has not granted it yet still lands where it was heading; the Settings card offers the backup.
  return go(to);
}
