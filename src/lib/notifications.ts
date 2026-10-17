import { pool } from "./auth";

// What happened on a creative's links since they last looked: a client opened a delivery, saved files from it, or
// asked for something. Downloads from one visit are folded into one line ("saved 6 files"), so a "Save all" is one
// notification, not six.
export type Notice = {
  id: string;
  kind: "open" | "download" | "request";
  deliveryId: string;
  title: string;
  clientName: string | null;
  device: string | null;
  fileName: string | null;
  count: number;
  at: Date;
};

// The live notes never reach further back than a week and never return more than a screenful; the Notifications page
// asks for a month and a longer list.
export async function listNotices(
  ownerId: string,
  after: Date,
  { days = 7, limit = 20 }: { days?: number; limit?: number } = {},
): Promise<Notice[]> {
  const floor = new Date(Math.max(after.getTime(), Date.now() - days * 24 * 3600 * 1000));
  const { rows } = await pool.query<Notice>(
    `select * from (
       select e."id"::text as "id", 'open' as "kind", d."id" as "deliveryId", d."title", d."clientName",
              e."device", null as "fileName", 1 as "count", e."at"
         from "deliveryEvent" e join "delivery" d on d."id" = e."deliveryId"
        where d."ownerId" = $1 and e."kind" = 'open' and e."at" > $2
       union all
       select d."id"::text || ':' || coalesce(e."visit", min(e."id"::text)), 'download', d."id", d."title", d."clientName",
              min(e."device"), min(e."fileName"), count(*)::int, max(e."at")
         from "deliveryEvent" e join "delivery" d on d."id" = e."deliveryId"
        where d."ownerId" = $1 and e."kind" = 'download' and e."at" > $2
        group by d."id", coalesce(e."visit", e."id"::text), e."visit"
        -- wait until a "Save all" has finished, so it arrives as one line with the full count
       having max(e."at") < now() - interval '6 seconds'
       union all
       select r."id"::text, 'request', d."id", d."title", d."clientName",
              null, r."fileName", 1, r."createdAt"
         from "fileRequest" r join "delivery" d on d."id" = r."deliveryId"
        where d."ownerId" = $1 and r."createdAt" > $2
     ) n
     order by "at" desc
     limit $3`,
    [ownerId, floor, limit],
  );
  return rows;
}

// When the creative last looked at the Notifications page. Never looked: everything from the last day counts as new,
// so a first visit does not open on a month of unread lines.
export async function getSeenAt(ownerId: string): Promise<Date> {
  const { rows } = await pool.query<{ seenAt: Date }>(`select "seenAt" from "noticeSeen" where "userId" = $1`, [ownerId]);
  return rows[0]?.seenAt ?? new Date(Date.now() - 24 * 3600 * 1000);
}

export async function markSeen(ownerId: string): Promise<void> {
  await pool.query(
    `insert into "noticeSeen" ("userId", "seenAt") values ($1, now())
     on conflict ("userId") do update set "seenAt" = excluded."seenAt"`,
    [ownerId],
  );
}

// How many lines the Notifications page would show as new. Feeds the dot on the sidebar.
export async function countUnread(ownerId: string): Promise<number> {
  const seenAt = await getSeenAt(ownerId);
  const notices = await listNotices(ownerId, seenAt, { days: 30, limit: 100 });
  return notices.length;
}
