import { getPublishedRef } from "@/lib/deliveries";
import { recordOpen } from "@/lib/delivery-events";

// The client's page calls this once its tab has been showing the delivery for a moment. Link scanners and chat
// previews fetch the page but do not run scripts, so they never get here. The answer is always the same, so
// nobody can use it to find out which links exist.
export async function POST(request: Request, context: RouteContext<"/d/[slug]/seen">) {
  const { slug } = await context.params;
  try {
    const body: unknown = await request.json();
    const visit = typeof body === "object" && body !== null && "visit" in body ? body.visit : null;
    if (typeof visit === "string" && /^[A-Za-z0-9-]{8,64}$/.test(visit)) {
      const delivery = await getPublishedRef(slug);
      if (delivery) await recordOpen(delivery, visit, request.headers);
    }
  } catch (error) {
    console.error("Could not record an open", error);
  }
  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
