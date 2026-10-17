"use server";

import { revalidatePath } from "next/cache";
import { pool } from "./auth";
import type { ActionResult } from "./delivery-actions";
import { downloadName, isUuid } from "./deliveries";
import { requireUser } from "./session";
import { deleteObjects, presignDownload, storageConfigured } from "./storage";

// Earlier versions of a file: the copies kept when a file is replaced. Only the signed-in owner can reach them,
// and every query joins up to the delivery's owner, which is the access check.

type OwnedVersion = {
  id: string;
  fileId: string;
  storageKey: string;
  thumbKey: string | null;
  sizeBytes: string;
  mimeType: string | null;
  ext: string | null;
  deliveryId: string;
  fileName: string;
};

const fail = (error: string) => ({ ok: false as const, error });

async function loadOwnedVersion(versionId: string, ownerId: string): Promise<OwnedVersion | null> {
  if (!isUuid(versionId)) return null;
  const { rows } = await pool.query<OwnedVersion>(
    `select v."id", v."fileId", v."storageKey", v."thumbKey", v."sizeBytes", v."mimeType", v."ext",
            s."deliveryId", f."name" as "fileName"
       from "deliveryFileVersion" v
       join "deliveryFile" f on f."id" = v."fileId"
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"
      where v."id" = $1 and d."ownerId" = $2`,
    [versionId, ownerId],
  );
  return rows[0] ?? null;
}

function refresh(deliveryId: string) {
  revalidatePath(`/deliveries/${deliveryId}`);
  revalidatePath("/dashboard");
  revalidatePath("/deliveries");
}

export async function versionDownloadUrl(versionId: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const user = await requireUser();
  if (!storageConfigured()) return fail("File storage is not connected yet.");
  const version = await loadOwnedVersion(versionId, user.id);
  if (!version) return fail("This version was not found.");
  const url = await presignDownload(version.storageKey, downloadName(`${version.fileName} (earlier version)`, version.ext), version.mimeType);
  return { ok: true, url };
}

export async function deleteVersion(versionId: string): Promise<ActionResult> {
  const user = await requireUser();
  const version = await loadOwnedVersion(versionId, user.id);
  if (!version) return fail("This version was not found.");
  await pool.query(`delete from "deliveryFileVersion" where "id" = $1`, [versionId]);
  await deleteObjects([version.storageKey, ...(version.thumbKey ? [version.thumbKey] : [])]);
  refresh(version.deliveryId);
  return { ok: true };
}

// Puts an earlier version back as the file's current copy. The copy it replaces is kept as a version, so a restore
// can be undone by restoring again.
export async function restoreVersion(versionId: string): Promise<ActionResult> {
  const user = await requireUser();
  const version = await loadOwnedVersion(versionId, user.id);
  if (!version) return fail("This version was not found.");
  const client = await pool.connect();
  try {
    await client.query("begin");
    const current = await client.query<{ storageKey: string | null; pending: unknown }>(
      `select "storageKey", "pending" from "deliveryFile" where "id" = $1 for update`,
      [version.fileId],
    );
    if (!current.rows[0]) {
      await client.query("rollback");
      return fail("This file was not found.");
    }
    if (current.rows[0].pending) {
      await client.query("rollback");
      return fail("An upload for this file is in progress. Finish or cancel it first.");
    }
    if (current.rows[0].storageKey) {
      await client.query(
        `insert into "deliveryFileVersion" ("fileId", "storageKey", "thumbKey", "sizeBytes", "mimeType", "ext")
         select "id", "storageKey", "thumbKey", "sizeBytes", "mimeType", "ext" from "deliveryFile" where "id" = $1`,
        [version.fileId],
      );
    }
    await client.query(
      `update "deliveryFile"
          set "storageKey" = $2, "thumbKey" = $3, "sizeBytes" = $4, "mimeType" = $5, "ext" = $6, "replacedAt" = now()
        where "id" = $1`,
      [version.fileId, version.storageKey, version.thumbKey, version.sizeBytes, version.mimeType, version.ext],
    );
    await client.query(`delete from "deliveryFileVersion" where "id" = $1`, [versionId]);
    await client.query(`update "delivery" set "updatedAt" = now() where "id" = $1`, [version.deliveryId]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => {});
    console.error("Could not restore a version", error);
    return fail("Could not restore this version. Try again.");
  } finally {
    client.release();
  }
  refresh(version.deliveryId);
  return { ok: true };
}
