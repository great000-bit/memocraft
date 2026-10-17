"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { pool } from "./auth";
import { isUuid } from "./deliveries";
import { limits } from "./delivery-limits";
import { requireUser } from "./session";
import {
  completeMultipart,
  discardPending,
  headObject,
  deleteObjects,
  newObjectKey,
  presignPart,
  presignPut,
  startMultipart,
  storageConfigured,
  type PendingUpload,
} from "./storage";
import { formatSize, partSizeFor, storageLimits } from "./storage-limits";

export type BeginUploadInput = { sectionId: string; fileId?: string; name: string; size: number; type: string };

export type BeginUploadResult =
  | { ok: false; error: string }
  | {
      ok: true;
      fileId: string;
      // The browser must send exactly this Content-Type with a single upload.
      contentType: string;
      // Set for a file small enough to go up in one request.
      singleUrl: string | null;
      // Set for larger files: one signed URL per part, in order.
      parts: { number: number; url: string; size: number }[];
    };

type Result = { ok: true } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });

const typePattern = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;

function cleanName(raw: string): string {
  const base = (raw.split(/[\\/]/).pop() ?? "").trim();
  if (base.length <= limits.fileName) return base;
  const dot = base.lastIndexOf(".");
  const ext = dot > 0 && base.length - dot <= 11 ? base.slice(dot) : "";
  return base.slice(0, limits.fileName - ext.length) + ext;
}

function extensionOf(name: string): string | null {
  const match = /\.([A-Za-z0-9]{1,10})$/.exec(name);
  return match ? match[1].toLowerCase() : null;
}

function partSizes(size: number): number[] {
  const part = partSizeFor(size);
  const sizes: number[] = [];
  for (let offset = 0; offset < size; offset += part) sizes.push(Math.min(part, size - offset));
  return sizes;
}

export async function beginUpload(input: BeginUploadInput): Promise<BeginUploadResult> {
  const user = await requireUser();
  if (!storageConfigured()) return fail("File storage is not connected yet.");
  if (!isUuid(input.sectionId) || (input.fileId !== undefined && !isUuid(input.fileId))) return fail("This section was not found.");

  const size = input.size;
  if (!Number.isSafeInteger(size) || size < 1) return fail("This file is empty.");
  if (size > storageLimits.maxFileBytes) return fail(`Files can be up to ${formatSize(storageLimits.maxFileBytes)} for now.`);

  const name = cleanName(typeof input.name === "string" ? input.name : "");
  if (!name) return fail("This file needs a name.");
  const type = typePattern.test(input.type) ? input.type.toLowerCase() : "application/octet-stream";

  const owned = await pool.query<{ deliveryId: string }>(
    `select d."id" as "deliveryId" from "deliverySection" s join "delivery" d on d."id" = s."deliveryId"
      where s."id" = $1 and d."ownerId" = $2`,
    [input.sectionId, user.id],
  );
  const deliveryId = owned.rows[0]?.deliveryId;
  if (!deliveryId) return fail("This section was not found.");

  let previousPending: PendingUpload | null = null;
  if (input.fileId) {
    const existing = await pool.query<{ pending: PendingUpload | null }>(
      `select "pending" from "deliveryFile" where "id" = $1 and "sectionId" = $2`,
      [input.fileId, input.sectionId],
    );
    if (!existing.rows[0]) return fail("This file was not found.");
    previousPending = existing.rows[0].pending;
  }

  // Counted: attached files, plus uploads started in the last day. A replaced file does not count against itself.
  const usage = await pool.query<{ used: string }>(
    `select coalesce(sum(case when f."storageKey" is not null then f."sizeBytes" end), 0)
          + coalesce(sum(case when f."pending" is not null and (f."pending"->>'at')::timestamptz > now() - interval '24 hours'
                              then (f."pending"->>'size')::bigint end), 0) as "used"
       from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"
      where d."ownerId" = $1 and ($2::uuid is null or f."id" <> $2::uuid)`,
    [user.id, input.fileId ?? null],
  );
  if (Number(usage.rows[0].used) + size > storageLimits.accountBytes) {
    return fail(`This would pass your ${formatSize(storageLimits.accountBytes)} of storage. Remove a file or upload less.`);
  }

  const fileId = input.fileId ?? randomUUID();
  const key = newObjectKey(deliveryId, fileId);
  const multipart = size > storageLimits.singleUploadMaxBytes;

  let uploadId: string | null = null;
  try {
    if (multipart) uploadId = await startMultipart(key, type);
    const pending: PendingUpload = { key, uploadId, size, type, ext: extensionOf(name), at: new Date().toISOString() };

    if (input.fileId) {
      await pool.query(`update "deliveryFile" set "pending" = $1 where "id" = $2`, [JSON.stringify(pending), fileId]);
    } else {
      await pool.query(
        `insert into "deliveryFile" ("id", "sectionId", "name", "position", "pending")
         values ($1, $2, $3, coalesce((select max("position") + 1 from "deliveryFile" where "sectionId" = $2), 0), $4)`,
        [fileId, input.sectionId, name, JSON.stringify(pending)],
      );
    }
    if (previousPending) await discardPending(previousPending);

    if (!multipart) {
      return { ok: true, fileId, contentType: type, singleUrl: await presignPut(key, type, size), parts: [] };
    }
    const sizes = partSizes(size);
    const parts = await Promise.all(
      sizes.map(async (partSize, index) => ({
        number: index + 1,
        size: partSize,
        url: await presignPart(key, uploadId as string, index + 1, partSize),
      })),
    );
    return { ok: true, fileId, contentType: type, singleUrl: null, parts };
  } catch (error) {
    console.error("Could not start an upload", error);
    if (uploadId) await discardPending({ key, uploadId, size, type, ext: null, at: "" });
    return fail("Storage did not respond. Try again in a moment.");
  }
}

type PendingRow = { storageKey: string | null; pending: PendingUpload | null; deliveryId: string };

async function loadOwnedFile(fileId: string, ownerId: string): Promise<PendingRow | null> {
  if (!isUuid(fileId)) return null;
  const { rows } = await pool.query<PendingRow>(
    `select f."storageKey", f."pending", s."deliveryId"
       from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"
      where f."id" = $1 and d."ownerId" = $2`,
    [fileId, ownerId],
  );
  return rows[0] ?? null;
}

function refresh(deliveryId: string) {
  revalidatePath(`/deliveries/${deliveryId}`);
  revalidatePath("/dashboard");
  revalidatePath("/deliveries");
}

// Called by the browser once every byte is sent. The server checks storage itself before it trusts the upload.
export async function completeUpload(fileId: string): Promise<Result> {
  const user = await requireUser();
  const row = await loadOwnedFile(fileId, user.id);
  if (!row) return fail("This file was not found.");
  const pending = row.pending;
  if (!pending) return fail("There is no upload in progress for this file.");

  try {
    if (pending.uploadId) {
      const joined = await completeMultipart(pending.key, pending.uploadId, partSizes(pending.size));
      if (!joined) return fail("Some of the file did not arrive. Try the upload again.");
    }
    const stored = await headObject(pending.key);
    if (!stored || stored.size !== pending.size) {
      await discardPending(pending);
      await pool.query(`update "deliveryFile" set "pending" = null where "id" = $1`, [fileId]);
      return fail("The upload did not finish. Try again.");
    }
  } catch (error) {
    console.error("Could not finish an upload", error);
    return fail("Storage did not respond. Try again in a moment.");
  }

  const updated = await pool.query(
    `update "deliveryFile"
        set "storageKey" = $1, "sizeBytes" = $2, "mimeType" = $3, "ext" = $4, "pending" = null
      where "id" = $5 and "pending"->>'key' = $1`,
    [pending.key, pending.size, pending.type, pending.ext, fileId],
  );
  if (!updated.rowCount) return fail("This upload was replaced by a newer one.");
  await pool.query(`update "delivery" set "updatedAt" = now() where "id" = $1`, [row.deliveryId]);
  if (row.storageKey && row.storageKey !== pending.key) await deleteObjects([row.storageKey]);
  refresh(row.deliveryId);
  return { ok: true };
}

// Called when the person cancels or an upload fails. A file row that never got a file is removed with it.
export async function abortUpload(fileId: string): Promise<Result> {
  const user = await requireUser();
  const row = await loadOwnedFile(fileId, user.id);
  if (!row) return fail("This file was not found.");
  if (row.pending) await discardPending(row.pending);
  if (row.storageKey) {
    await pool.query(`update "deliveryFile" set "pending" = null where "id" = $1`, [fileId]);
  } else {
    await pool.query(`delete from "deliveryFile" where "id" = $1`, [fileId]);
  }
  refresh(row.deliveryId);
  return { ok: true };
}
