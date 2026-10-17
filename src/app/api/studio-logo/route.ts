import { getSession } from "@/lib/session";
import { studioLogoKey } from "@/lib/studio";
import { getObject, storageConfigured } from "@/lib/storage";

// The signed-in person's own studio logo, for the profile and the delivery preview. Clients load it through the
// delivery link instead (/d/<slug>/logo).
export async function GET() {
  const session = await getSession();
  if (!session || !storageConfigured()) return new Response(null, { status: 404 });
  const logo = await getObject(studioLogoKey(session.user.id));
  if (!logo) return new Response(null, { status: 404 });
  return new Response(logo.bytes as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
