import { getSession } from "@/lib/session";
import { avatarKey } from "@/lib/profile";
import { getObject, storageConfigured } from "@/lib/storage";

// A profile picture someone uploaded. Only that person is shown it, for now: the workspace is the only place a
// picture appears. The address carries a version, so a browser can keep a picture for a day and still pick up a new one.
export async function GET(_request: Request, context: RouteContext<"/api/avatar/[userId]">) {
  const { userId } = await context.params;
  const session = await getSession();
  if (!session || session.user.id !== userId || !storageConfigured()) return new Response(null, { status: 404 });
  const photo = await getObject(avatarKey(userId));
  if (!photo) return new Response(null, { status: 404 });
  return new Response(photo.bytes as BodyInit, {
    headers: {
      "Content-Type": photo.type,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
