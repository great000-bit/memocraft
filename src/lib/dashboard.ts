import { pool } from "./auth";
import { storageLimits } from "./storage-limits";

export type DashboardStats = {
  clients: { total: number; newThisMonth: number };
  storage: { usedBytes: number; limitBytes: number; fileCount: number };
  // Out of the deliveries that are published: how many were opened, and how many had a file downloaded.
  proof: { published: number; opened: number; downloaded: number };
};

// The numbers on the dashboard cards. A client is a distinct client name across the creative's deliveries, so
// "Maison Aurel" typed twice is one client.
export async function getDashboardStats(ownerId: string): Promise<DashboardStats> {
  const [clients, storage, proof] = await Promise.all([
    pool.query<{ total: string; newThisMonth: string }>(
      `select count(*) as "total",
              count(*) filter (where c."first" >= date_trunc('month', now())) as "newThisMonth"
         from (select min("createdAt") as "first"
                 from "delivery"
                where "ownerId" = $1 and btrim(coalesce("clientName", '')) <> ''
                group by lower(btrim("clientName"))) c`,
      [ownerId],
    ),
    // The same count the upload check uses: files that are in storage plus their earlier versions, not pictures
    // made for previews.
    pool.query<{ used: string; files: string }>(
      `select coalesce(sum(f."sizeBytes") filter (where f."storageKey" is not null), 0)
              + coalesce(sum((select coalesce(sum(v."sizeBytes"), 0) from "deliveryFileVersion" v where v."fileId" = f."id")), 0) as "used",
              count(*) filter (where f."storageKey" is not null) as "files"
         from "deliveryFile" f
         join "deliverySection" s on s."id" = f."sectionId"
         join "delivery" d on d."id" = s."deliveryId"
        where d."ownerId" = $1`,
      [ownerId],
    ),
    pool.query<{ published: string; opened: string; downloaded: string }>(
      `select count(*) as "published",
              count(*) filter (where ev."seen" > 0) as "opened",
              count(*) filter (where ev."downloads" > 0) as "downloaded"
         from "delivery" d
         cross join lateral (
           select count(*) as "seen",
                  count(*) filter (where e."kind" = 'download') as "downloads"
             from "deliveryEvent" e where e."deliveryId" = d."id"
         ) ev
        where d."ownerId" = $1 and d."status" = 'published'`,
      [ownerId],
    ),
  ]);

  return {
    clients: { total: Number(clients.rows[0].total), newThisMonth: Number(clients.rows[0].newThisMonth) },
    storage: {
      usedBytes: Number(storage.rows[0].used),
      limitBytes: storageLimits.accountBytes,
      fileCount: Number(storage.rows[0].files),
    },
    proof: {
      published: Number(proof.rows[0].published),
      opened: Number(proof.rows[0].opened),
      downloaded: Number(proof.rows[0].downloaded),
    },
  };
}
