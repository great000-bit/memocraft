import { connection } from "next/server";
import { getPublishedThumb } from "@/lib/deliveries";
import { passesPassword } from "@/lib/link-access";
import { presignClientThumb, storageConfigured } from "@/lib/storage";

// The small picture shown beside a file on the client page. Checked against the database on every request, like
// downloads, so a delivery that is paused, expired or still behind its password stops showing pictures. Nothing is recorded: only a real open or
// download counts as proof of delivery. The browser may keep the redirect for a few minutes, never longer than the
// signed link behind it lives.
export async function GET(_request: Request, context: RouteContext<"/d/[slug]/files/[fileId]/preview">) {
  await connection();
  const { slug, fileId } = await context.params;
  const thumb = await getPublishedThumb(slug, fileId);
  if (!thumb || !storageConfigured() || !(await passesPassword(thumb.deliveryId, thumb.passwordHash))) {
    return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: await presignClientThumb(thumb.thumbKey),
      "Cache-Control": "private, max-age=300",
      "Referrer-Policy": "no-referrer",
    },
  });
}
