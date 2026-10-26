import { loadEnhanceSource } from "@/lib/enhance-browser";
import { getSession } from "@/lib/session";
import { workspaceForSession } from "@/lib/team";
import { storageConfigured } from "@/lib/storage";

export const maxDuration = 30;

// The picture the in-browser enhancer works on. Only the owner of the photo and their team can fetch it.
export async function GET(_request: Request, context: RouteContext<"/api/enhance/source/[fileId]">) {
  const { fileId } = await context.params;
  const workspace = await workspaceForSession(await getSession());
  if (!workspace || !storageConfigured()) return new Response(null, { status: 404 });
  const source = await loadEnhanceSource(workspace.ownerId, fileId).catch((error) => {
    console.error("Could not prepare an enhance source", error);
    return { error: "Could not prepare the photo.", status: 500 };
  });
  if ("error" in source) return new Response(source.error, { status: source.status });
  return new Response(source.bytes as BodyInit, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
