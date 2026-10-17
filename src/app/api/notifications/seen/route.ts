import { markSeen } from "@/lib/notifications";
import { getSession } from "@/lib/session";

// Opening the Notifications page marks everything on it as read.
export async function POST() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  await markSeen(session.user.id);
  return Response.json({ ok: true });
}
