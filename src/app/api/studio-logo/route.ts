import { getSession } from "@/lib/session";
import { isOnTeam } from "@/lib/team";
import { studioLogoKey } from "@/lib/studio";
import { getObject, storageConfigured } from "@/lib/storage";

// The signed-in person's own studio logo, for the profile and the delivery preview. Clients load it through the
// delivery link instead (/d/<slug>/logo). ?owner=<id> asks for the logo of a team the person is on.
export async function GET(request: Request) {
  const session = await getSession();
  if (!session || !storageConfigured()) return new Response(null, { status: 404 });
  const ownerId = new URL(request.url).searchParams.get("owner") ?? session.user.id;
  if (!(await isOnTeam(ownerId, session.user.id))) return new Response(null, { status: 404 });
  const logo = await getObject(studioLogoKey(ownerId));
  if (!logo) return new Response(null, { status: 404 });
  return new Response(logo.bytes as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
