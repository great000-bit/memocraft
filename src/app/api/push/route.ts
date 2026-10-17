import { describeDevice } from "@/lib/delivery-events";
import { pushConfigured, removePushSubscription, savePushSubscription } from "@/lib/push";
import { getSession } from "@/lib/session";

// This device switches phone notifications on (POST) or off (DELETE). The body is the browser's push subscription.
type Body = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

function text(value: unknown, max: number) {
  return typeof value === "string" && value.length > 0 && value.length <= max ? value : null;
}

async function readBody(request: Request): Promise<Body | null> {
  try {
    return (await request.json()) as Body;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  if (!pushConfigured()) return Response.json({ error: "Phone notifications are not set up yet." }, { status: 503 });
  const body = await readBody(request);
  const endpoint = text(body?.endpoint, 2000);
  const p256dh = text(body?.keys?.p256dh, 200);
  const auth = text(body?.keys?.auth, 100);
  if (!endpoint || !endpoint.startsWith("https://") || !p256dh || !auth) {
    return Response.json({ error: "That subscription is not valid." }, { status: 400 });
  }
  const device = describeDevice(request.headers) ?? "This device";
  await savePushSubscription(session.user.id, { endpoint, p256dh, auth }, device);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not signed in" }, { status: 401 });
  const endpoint = text((await readBody(request))?.endpoint, 2000);
  if (endpoint) await removePushSubscription(session.user.id, endpoint);
  return Response.json({ ok: true });
}
