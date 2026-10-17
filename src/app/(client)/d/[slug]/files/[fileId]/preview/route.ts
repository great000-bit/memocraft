import { connection } from "next/server";
import { getPublishedThumbKey } from "@/lib/deliveries";
import { presignClientThumb, storageConfigured } from "@/lib/storage";

// The small picture shown beside a file on the client page. Checked against the database on every request, like
// downloads, so a delivery that is unpublished stops showing pictures. Nothing is recorded: only a real open or
// download counts as proof of delivery. The browser may keep the redirect for a few minutes, never longer than the
// signed link behind it lives.
export async function GET(_request: Request, context: RouteContext<"/d/[slug]/files/[fileId]/preview">) {
  await connection();
  const { slug, fileId } = await context.params;
  const key = await getPublishedThumbKey(slug, fileId);
  if (!key || !storageConfigured()) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(null, {
    status: 302,
    headers: {
      Location: await presignClientThumb(key),
      "Cache-Control": "private, max-age=300",
      "Referrer-Policy": "no-referrer",
    },
  });
}
