import { getSession } from "@/lib/session";
import { countUnread, listNotices } from "@/lib/notifications";

// The workspace asks here every little while for what clients did since `after`. The answer carries the server's own
// clock, so the next question never depends on the device's clock being right.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const now = new Date();
  const raw = new URL(request.url).searchParams.get("after");
  const after = raw ? new Date(raw) : null;
  const valid = after && !Number.isNaN(after.getTime());
  // "unread" is the count behind the dot on the sidebar's Notifications link.
  const [notices, unread] = await Promise.all([valid ? listNotices(session.user.id, after) : [], countUnread(session.user.id)]);
  return Response.json({ now: now.toISOString(), notices, unread }, { headers: { "Cache-Control": "no-store" } });
}
