import { runDriveBackup, usersWithWaitingFiles } from "@/lib/drive";

export const maxDuration = 60;

// Daily safety net: finishes copies that stopped halfway (a closed tab, a slow upload). Vercel sends the
// CRON_SECRET as a bearer token; without that secret set, nobody can run it.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  const users = await usersWithWaitingFiles();
  const deadline = Date.now() + 50_000;
  for (const userId of users) {
    const left = deadline - Date.now();
    if (left < 5_000) break;
    await runDriveBackup(userId, left - 2_000);
  }
  return Response.json({ users: users.length });
}
