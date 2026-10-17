import { sendTestPush } from "@/lib/push";
import { getSession } from "@/lib/session";

// "Send a test" on the Notifications page: one line to every device this account switched on.
export async function POST() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const devices = await sendTestPush(session.user.id);
  return Response.json({ devices });
}
