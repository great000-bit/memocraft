import { proofPdf } from "@/lib/proof-pdf";
import { getDeliveryForOwner } from "@/lib/deliveries";
import { getSession } from "@/lib/session";

// The proof of delivery certificate as a PDF, for the signed-in owner only.
export async function GET(_request: Request, context: RouteContext<"/api/deliveries/[id]/proof">) {
  const session = await getSession();
  if (!session) return new Response("Sign in first.", { status: 401 });
  const { id } = await context.params;
  const delivery = await getDeliveryForOwner(id, session.user.id);
  if (!delivery) return new Response("Not found.", { status: 404 });
  const { bytes, fileName } = await proofPdf(delivery, session.user);
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
