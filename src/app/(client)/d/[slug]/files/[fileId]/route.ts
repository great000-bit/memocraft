import { connection } from "next/server";
import { downloadName, getPublishedFile } from "@/lib/deliveries";
import { presignDownload, storageConfigured } from "@/lib/storage";

// A client's download button points here. The link stays the same for the life of the delivery; each request
// is checked against the database and handed a short-lived signed link to the file, saved under the label the
// creative chose. This is also where proof of download will be recorded.
export async function GET(_request: Request, context: RouteContext<"/d/[slug]/files/[fileId]">) {
  await connection();
  const { slug, fileId } = await context.params;
  const file = await getPublishedFile(slug, fileId);
  if (!file || !storageConfigured()) return new Response("This file is not available.", { status: 404 });
  const url = await presignDownload(file.storageKey, downloadName(file.name, file.ext), file.mimeType);
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
