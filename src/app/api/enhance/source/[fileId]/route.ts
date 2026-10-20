import { loadEnhanceSource } from "@/lib/enhance-browser";
import { getSession } from "@/lib/session";
import { storageConfigured } from "@/lib/storage";

export const maxDuration = 30;

// The picture the in-browser enhancer works on. Only the owner of the photo can fetch it.
export async function GET(_request: Request, context: RouteContext<"/api/enhance/source/[fileId]">) {
  const { fileId } = await context.params;
  const session = await getSession();
  if (!session || !storageConfigured()) return new Response(null, { status: 404 });
  const source = await loadEnhanceSource(session.user.id, fileId).catch((error) => {
    console.error("Could not prepare an enhance source", error);
    return { error: "Could not prepare the photo.", status: 500 };
  });
  if ("error" in source) return new Response(source.error, { status: source.status });
  return new Response(source.bytes as BodyInit, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
