import { connection } from "next/server";
import { pool } from "@/lib/auth";
import { isUuid } from "@/lib/deliveries";
import { getSession } from "@/lib/session";
import { workspaceForSession } from "@/lib/team";
import { presignDownload, presignView, storageConfigured } from "@/lib/storage";

// Memo Explorer's own link to a file, for the signed-in owner and their team only: a download, or with ?view=1 the file shown
// inline (the preview pane's full-size picture, video or PDF). Owner downloads are never recorded as proof of delivery.
export async function GET(request: Request, context: RouteContext<"/api/explorer/files/[source]/[id]">) {
  await connection();
  const { source, id } = await context.params;
  const workspace = await workspaceForSession(await getSession());
  const missing = new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  if (!workspace || !isUuid(id) || !storageConfigured()) return missing;

  let file: { name: string; ext: string | null; mimeType: string | null; storageKey: string } | undefined;
  if (source === "library") {
    const { rows } = await pool.query<{ name: string; ext: string | null; mimeType: string | null; storageKey: string }>(
      `select "name", null as "ext", "mimeType", "storageKey" from "libraryFile"
        where "id" = $1 and "ownerId" = $2 and "storageKey" is not null`,
      [id, workspace.ownerId],
    );
    file = rows[0];
  } else if (source === "delivery") {
    const { rows } = await pool.query<{ name: string; ext: string | null; mimeType: string | null; storageKey: string }>(
      `select f."name", f."ext", f."mimeType", f."storageKey"
         from "deliveryFile" f
         join "deliverySection" s on s."id" = f."sectionId"
         join "delivery" d on d."id" = s."deliveryId"
        where f."id" = $1 and d."ownerId" = $2 and f."storageKey" is not null`,
      [id, workspace.ownerId],
    );
    file = rows[0];
  }
  if (!file) return missing;

  const filename = file.ext ? `${file.name}.${file.ext}` : file.name;
  const view = new URL(request.url).searchParams.get("view") === "1";
  const location = view
    ? await presignView(file.storageKey, file.mimeType ?? "application/octet-stream")
    : await presignDownload(file.storageKey, filename, file.mimeType);
  return new Response(null, {
    status: 302,
    headers: { Location: location, "Cache-Control": "private, max-age=300", "Referrer-Policy": "no-referrer" },
  });
}
