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

// Never reaches further back than a week, and never returns more than a screenful.
export async function listNotices(ownerId: string, after: Date): Promise<Notice[]> {
  const floor = new Date(Math.max(after.getTime(), Date.now() - 7 * 24 * 3600 * 1000));
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
     limit 20`,
    [ownerId, floor],
  );
  return rows;
}
