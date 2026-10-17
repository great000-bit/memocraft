import { getSession } from "@/lib/session";
import { listNotices } from "@/lib/notifications";

// The workspace asks here every little while for what clients did since `after`. The answer carries the server's own
// clock, so the next question never depends on the device's clock being right.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const now = new Date();
  const raw = new URL(request.url).searchParams.get("after");
  const after = raw ? new Date(raw) : null;
  if (!after || Number.isNaN(after.getTime())) {
    return Response.json({ now: now.toISOString(), notices: [] }, { headers: { "Cache-Control": "no-store" } });
  }
  const notices = await listNotices(session.user.id, after);
  return Response.json({ now: now.toISOString(), notices }, { headers: { "Cache-Control": "no-store" } });
}
