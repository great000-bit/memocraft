import { userAgent } from "next/server";
import { auth, pool } from "./auth";
import { notifyOwner } from "./push";

// Proof of delivery: what the client did with the link. Only real browsers count, and never the owner.

export type ActivityEvent = {
  id: string;
  kind: "open" | "download";
  fileName: string | null;
  device: string;
  at: Date;
};

export type Activity = {
  opens: number;
  downloads: number;
  firstOpenedAt: Date | null;
  firstOpenedOn: string | null;
  recent: ActivityEvent[];
};

// Link scanners and chat apps fetch links to build previews. They are not the client.
const automated =
  /bot|crawl|spider|slurp|preview|embed|unfurl|fetch|scan|monitor|headless|lighthouse|^whatsapp|facebookexternalhit|curl|wget|python|axios|go-http|java\//i;

// A short label for the device, or null when the request looks automated.
export function describeDevice(headers: Headers): string | null {
  const raw = headers.get("user-agent") ?? "";
  if (!raw || automated.test(raw)) return null;
  const agent = userAgent({ headers });
  if (agent.isBot) return null;
  const os = agent.os.name ?? "";
  if (agent.device.type === "mobile") return os === "iOS" ? "iPhone" : os === "Android" ? "Android phone" : "Phone";
  if (agent.device.type === "tablet") return os === "iOS" ? "iPad" : os === "Android" ? "Android tablet" : "Tablet";
  if (/mac/i.test(os)) return "Mac";
  if (/windows/i.test(os)) return "Windows";
  if (/linux|ubuntu|debian|fedora|chrom/i.test(os)) return "Linux";
  return "Computer";
}

export async function isOwner(headers: Headers, ownerId: string): Promise<boolean> {
  try {
    const session = await auth.api.getSession({ headers });
    return session?.user.id === ownerId;
  } catch {
    return false;
  }
}

// A link someone is hammering cannot fill the table: past this many events an hour, new ones are dropped.
const hourlyCap = 300;

type Target = { id: string; ownerId: string };

// One open per visit id. A reload in the same tab sends the same id and is ignored.
export async function recordOpen(delivery: Target, visit: string, headers: Headers): Promise<void> {
  const device = describeDevice(headers);
  if (!device || (await isOwner(headers, delivery.ownerId))) return;
  const inserted = await pool.query(
    `insert into "deliveryEvent" ("deliveryId", "kind", "visit", "device")
     select $1::uuid, 'open', $2::text, $3::text
      where (select count(*) from "deliveryEvent" where "deliveryId" = $1::uuid and "at" > now() - interval '1 hour') < $4::int
     on conflict do nothing`,
    [delivery.id, visit, device, hourlyCap],
  );
  if (inserted.rowCount) notifyOwner(delivery.id, "open");
}

export async function recordDownload(
  delivery: Target,
  file: { id: string; name: string },
  headers: Headers,
): Promise<void> {
  const device = describeDevice(headers);
  if (!device || (await isOwner(headers, delivery.ownerId))) return;
  // "earlier" counts downloads from this delivery in the two minutes before this one, so a "Save all" of 20 photos
  // sends one phone notification, not 20.
  const inserted = await pool.query<{ earlier: number }>(
    `insert into "deliveryEvent" ("deliveryId", "kind", "fileId", "fileName", "device")
     select $1::uuid, 'download', $2::uuid, $3::text, $4::text
      where (select count(*) from "deliveryEvent" where "deliveryId" = $1::uuid and "at" > now() - interval '1 hour') < $5::int
     returning (select count(*)::int from "deliveryEvent"
                 where "deliveryId" = $1::uuid and "kind" = 'download' and "at" > now() - interval '2 minutes') as "earlier"`,
    [delivery.id, file.id, file.name, device, hourlyCap],
  );
  if (inserted.rows[0] && inserted.rows[0].earlier === 0) notifyOwner(delivery.id, "download", file.name);
}

const recentLimit = 15;

// Everything the owner's editor shows. The join on ownerId is the access check.
export async function getActivity(deliveryId: string, ownerId: string): Promise<Activity> {
  const summary = await pool.query<{
    opens: string;
    downloads: string;
    firstOpenedAt: Date | null;
    firstOpenedOn: string | null;
  }>(
    `select count(*) filter (where e."kind" = 'open') as "opens",
            count(*) filter (where e."kind" = 'download') as "downloads",
            min(e."at") filter (where e."kind" = 'open') as "firstOpenedAt",
            (array_agg(e."device" order by e."at", e."id") filter (where e."kind" = 'open'))[1] as "firstOpenedOn"
       from "deliveryEvent" e join "delivery" d on d."id" = e."deliveryId"
      where e."deliveryId" = $1 and d."ownerId" = $2`,
    [deliveryId, ownerId],
  );
  const first = summary.rows[0];
  const recent = await pool.query<ActivityEvent>(
    `select e."id", e."kind", e."fileName", e."device", e."at"
       from "deliveryEvent" e join "delivery" d on d."id" = e."deliveryId"
      where e."deliveryId" = $1 and d."ownerId" = $2
      order by e."at" desc, e."id"
      limit $3`,
    [deliveryId, ownerId, recentLimit],
  );
  return {
    opens: Number(first?.opens ?? 0),
    downloads: Number(first?.downloads ?? 0),
    firstOpenedAt: first?.firstOpenedAt ?? null,
    firstOpenedOn: first?.firstOpenedOn ?? null,
    recent: recent.rows,
  };
}
