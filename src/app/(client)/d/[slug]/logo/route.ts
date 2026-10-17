import { getLinkBySlug } from "@/lib/deliveries";
import { studioLogoKey } from "@/lib/studio";
import { getObject, storageConfigured } from "@/lib/storage";

// The sender's studio logo, for anyone holding a published link. It is shown before the password and after the link
// expires too, like the sender's name, so the client always knows whose files these are. Nothing else is revealed.
export async function GET(_request: Request, context: RouteContext<"/d/[slug]/logo">) {
  const { slug } = await context.params;
  const link = await getLinkBySlug(slug);
  if (!link || !link.brand.logoSrc || !storageConfigured()) return new Response(null, { status: 404 });
  const logo = await getObject(studioLogoKey(link.ownerId));
  if (!logo) return new Response(null, { status: 404 });
  return new Response(logo.bytes as BodyInit, {
    headers: {
      "Content-Type": "image/png",
      // The address carries the logo's version, so a browser can keep it; a paused link stops serving it on the next visit.
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
