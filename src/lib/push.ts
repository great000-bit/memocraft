import webpush from "web-push";
import { after } from "next/server";
import { pool } from "./auth";

// Phone notifications (Web Push). The creative switches them on per device on the Notifications page; when a client
// opens a delivery, starts saving files or asks for something, every device they switched on gets one line. Until the
// VAPID keys are set, nothing here sends and the page says notifications are not set up.
export const pushConfigured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
export const pushPublicKey = () => (pushConfigured() ? process.env.VAPID_PUBLIC_KEY! : null);

let keysSet = false;
// A bad key or address is logged and switches push off; it must never break recording what the client did.
function ready() {
  if (!pushConfigured()) return false;
  if (!keysSet) {
    // The push services may contact this address about misuse; the app's own https address is enough.
    const site = process.env.BETTER_AUTH_URL ?? "";
    const subject = process.env.VAPID_SUBJECT || (site.startsWith("https://") ? site : "https://www.memocraft.space");
    try {
      webpush.setVapidDetails(subject, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
    } catch (error) {
      console.error("Phone notifications are off, the VAPID settings are not valid:", error instanceof Error ? error.message : error);
      return false;
    }
    keysSet = true;
  }
  return true;
}

export type PushKind = "open" | "download" | "request";

type Row = { id: string; endpoint: string; p256dh: string; auth: string };

async function deliver(ownerId: string, payload: { title: string; body: string; url: string; tag: string }) {
  const { rows } = await pool.query<Row>(
    `select "id", "endpoint", "p256dh", "auth" from "pushSubscription" where "userId" = $1`,
    [ownerId],
  );
  await Promise.all(
    rows.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload),
          { TTL: 24 * 3600, urgency: "normal" },
        );
        await pool.query(`update "pushSubscription" set "lastUsedAt" = now() where "id" = $1`, [row.id]);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // The device unsubscribed, or the app was removed from it: forget it.
        if (status === 404 || status === 410) {
          await pool.query(`delete from "pushSubscription" where "id" = $1`, [row.id]);
        } else {
          console.error("Could not send a phone notification:", status ?? (error instanceof Error ? error.message : error));
        }
      }
    }),
  );
}

async function notify(deliveryId: string, kind: PushKind, fileName: string | null) {
  const { rows } = await pool.query<{ ownerId: string; title: string; clientName: string | null; subs: number }>(
    `select d."ownerId", d."title", d."clientName",
            (select count(*)::int from "pushSubscription" s where s."userId" = d."ownerId") as "subs"
       from "delivery" d where d."id" = $1`,
    [deliveryId],
  );
  const delivery = rows[0];
  if (!delivery || delivery.subs === 0) return;
  const who = delivery.clientName?.trim() || "Your client";
  const body =
    kind === "open"
      ? `${who} opened ${delivery.title}`
      : kind === "download"
        ? `${who} is saving ${fileName ?? "files"} from ${delivery.title}`
        : `${who} asked about ${fileName ?? "a new file"} on ${delivery.title}`;
  await deliver(delivery.ownerId, {
    title: "Memocraft",
    body,
    url: kind === "request" ? "/requests" : `/deliveries/${deliveryId}`,
    // One line per delivery and kind on the lock screen: a newer one replaces the older.
    tag: `${kind}:${deliveryId}`,
  });
}

// Sent after the client's answer, so the client never waits on the push services.
export function notifyOwner(deliveryId: string, kind: PushKind, fileName: string | null = null): void {
  if (!ready()) return;
  const run = () =>
    notify(deliveryId, kind, fileName).catch((error) =>
      console.error("Phone notifications failed:", error instanceof Error ? error.message : error),
    );
  try {
    after(run);
  } catch {
    void run();
  }
}

export async function savePushSubscription(
  userId: string,
  sub: { endpoint: string; p256dh: string; auth: string },
  device: string,
): Promise<void> {
  // A device that signs in to another account moves to that account.
  await pool.query(
    `insert into "pushSubscription" ("userId", "endpoint", "p256dh", "auth", "device") values ($1, $2, $3, $4, $5)
     on conflict ("endpoint") do update
       set "userId" = excluded."userId", "p256dh" = excluded."p256dh", "auth" = excluded."auth", "device" = excluded."device"`,
    [userId, sub.endpoint, sub.p256dh, sub.auth, device],
  );
}

export async function removePushSubscription(userId: string, endpoint: string): Promise<void> {
  await pool.query(`delete from "pushSubscription" where "userId" = $1 and "endpoint" = $2`, [userId, endpoint]);
}

export async function sendTestPush(userId: string): Promise<number> {
  if (!ready()) return 0;
  const { rows } = await pool.query<{ n: number }>(`select count(*)::int as "n" from "pushSubscription" where "userId" = $1`, [
    userId,
  ]);
  await deliver(userId, {
    title: "Memocraft",
    body: "Notifications are on. You will hear here when a client opens or saves your files.",
    url: "/notifications",
    tag: "test",
  });
  return rows[0]?.n ?? 0;
}
