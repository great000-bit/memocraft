import { pool } from "./auth";
import { isUuid } from "./deliveries";

// Something a client asked for from the client page, as the owner sees it.
export type FileRequestItem = {
  id: string;
  message: string;
  // The label of the file the client asked about, as it was when they asked; null for "something new".
  fileName: string | null;
  status: "open" | "done";
  createdAt: Date;
  doneAt: Date | null;
  deliveryId: string;
  deliveryTitle: string;
  clientName: string | null;
};

// Open requests first, newest first, then the ones already handled. The join on ownerId is the access check.
export async function listRequests(
  ownerId: string,
  options: { deliveryId?: string; limit?: number } = {},
): Promise<FileRequestItem[]> {
  const deliveryId = options.deliveryId && isUuid(options.deliveryId) ? options.deliveryId : null;
  const { rows } = await pool.query<FileRequestItem>(
    `select r."id", r."message", r."fileName", r."status", r."createdAt", r."doneAt",
            d."id" as "deliveryId", d."title" as "deliveryTitle", d."clientName"
       from "fileRequest" r
       join "delivery" d on d."id" = r."deliveryId"
      where d."ownerId" = $1 and ($2::uuid is null or d."id" = $2::uuid)
      order by (r."status" = 'open') desc, r."createdAt" desc
      limit $3`,
    [ownerId, deliveryId, options.limit ?? 100],
  );
  return rows;
}

export async function countOpenRequests(ownerId: string): Promise<number> {
  const { rows } = await pool.query<{ open: string }>(
    `select count(*) as "open" from "fileRequest" r join "delivery" d on d."id" = r."deliveryId"
      where d."ownerId" = $1 and r."status" = 'open'`,
    [ownerId],
  );
  return Number(rows[0].open);
}
