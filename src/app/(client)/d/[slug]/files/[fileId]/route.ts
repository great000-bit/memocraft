import { after, connection } from "next/server";
import { downloadName, getPublishedFile } from "@/lib/deliveries";
import { recordDownload } from "@/lib/delivery-events";
import { passesPassword } from "@/lib/link-access";
import { presignDownload, storageConfigured } from "@/lib/storage";

// A client's download button points here. The link stays the same for the life of the delivery; each request
// is checked against the database (published, not expired, password typed if there is one) and handed a
// short-lived signed link to the file, saved under the label the creative chose. The start of each download is also recorded here as proof for the creative.
export async function GET(request: Request, context: RouteContext<"/d/[slug]/files/[fileId]">) {
  await connection();
  const { slug, fileId } = await context.params;
  const file = await getPublishedFile(slug, fileId);
  if (!file || !storageConfigured() || !(await passesPassword(file.deliveryId, file.passwordHash))) {
    return new Response("This file is not available.", { status: 404 });
  }
  const url = await presignDownload(file.storageKey, downloadName(file.name, file.ext), file.mimeType);
  // Recording happens after the redirect is sent, and a failure here must never stop a download.
  after(async () => {
    try {
      await recordDownload(
        { id: file.deliveryId, ownerId: file.ownerId },
        { id: fileId, name: downloadName(file.name, file.ext) },
        request.headers,
      );
    } catch (error) {
      console.error("Could not record a download", error);
    }
  });
  return new Response(null, {
    status: 302,
    headers: { Location: url, "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" },
  });
}
