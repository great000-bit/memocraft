import { after, connection } from "next/server";
import { downloadName, getPublishedFile } from "@/lib/deliveries";
import { recordDownload } from "@/lib/delivery-events";
import { passesPassword } from "@/lib/link-access";
import { presignDownload, storageConfigured } from "@/lib/storage";

// A client's download button points here. The link stays the same for the life of the delivery; each request
// is checked against the database (published, not expired, password typed if there is one) and handed a
// short-lived signed link to the file, saved under the label the creative chose. ?original=1 asks for the original
// of a photo that also has an enhanced copy. The start of each download is also recorded here as proof for the creative.
export async function GET(request: Request, context: RouteContext<"/d/[slug]/files/[fileId]">) {
  await connection();
  const { slug, fileId } = await context.params;
  const file = await getPublishedFile(slug, fileId);
  if (!file || !storageConfigured() || !(await passesPassword(file.deliveryId, file.passwordHash))) {
    return new Response("This file is not available.", { status: 404 });
  }
  // A photo with an enhanced copy hands out that copy, unless the client asked for the original.
  const enhanced = file.enhancedKey && new URL(request.url).searchParams.get("original") !== "1";
  const name = enhanced ? downloadName(`${file.name.replace(/\.[A-Za-z0-9]{1,10}$/, "")} (enhanced)`, "jpg") : downloadName(file.name, file.ext);
  const url = enhanced
    ? await presignDownload(file.enhancedKey as string, name, "image/jpeg")
    : await presignDownload(file.storageKey, name, file.mimeType);
  // Recording happens after the redirect is sent, and a failure here must never stop a download.
  after(async () => {
    try {
      await recordDownload(
        { id: file.deliveryId, ownerId: file.ownerId },
        { id: fileId, name },
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
