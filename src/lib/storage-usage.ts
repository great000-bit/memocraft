import { pool } from "./auth";

// Bytes an account holds: Memo Explorer files, attached files, enhanced copies, earlier versions kept from replaced files, and uploads
// started in the last day. A file being replaced still counts, because its current copy becomes a version when the
// new one arrives.
export async function storageUsed(ownerId: string): Promise<number> {
  const usage = await pool.query<{ used: string }>(
    `select coalesce(sum(case when f."storageKey" is not null then f."sizeBytes" end), 0)
          + coalesce(sum(f."enhancedBytes"), 0)
          + coalesce(sum(case when f."pending" is not null and (f."pending"->>'at')::timestamptz > now() - interval '24 hours'
                              then (f."pending"->>'size')::bigint end), 0)
          + coalesce(sum((select coalesce(sum(v."sizeBytes"), 0) from "deliveryFileVersion" v where v."fileId" = f."id")), 0) as "used"
       from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"
      where d."ownerId" = $1`,
    [ownerId],
  );
  const library = await pool.query<{ used: string }>(
    `select coalesce(sum(case when "storageKey" is not null then "sizeBytes" end), 0)
          + coalesce(sum(case when "pending" is not null and ("pending"->>'at')::timestamptz > now() - interval '24 hours'
                              then ("pending"->>'size')::bigint end), 0) as "used"
       from "libraryFile" where "ownerId" = $1`,
    [ownerId],
  );
  return Number(usage.rows[0].used) + Number(library.rows[0].used);
}
