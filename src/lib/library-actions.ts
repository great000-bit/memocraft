"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { pool } from "./auth";
import { createDeliveryRow, isUuid } from "./deliveries";
import { limits } from "./delivery-limits";
import { editableOwnerId, viewOnlyError } from "./team";
import {
  completeMultipart,
  copyObject,
  deleteObjects,
  discardPending,
  headObject,
  newLibraryKey,
  newObjectKey,
  presignPart,
  presignPut,
  removeStored,
  startMultipart,
  storageConfigured,
  type PendingUpload,
} from "./storage";
import { formatSize, partSizeFor, storageLimits } from "./storage-limits";
import { storageUsed } from "./storage-usage";
import type { BeginUploadResult } from "./upload-actions";

// Memo Explorer's actions. Like the delivery actions, every query checks ownership in SQL: a row is only read or
// changed when it belongs to the signed-in person.

type Result = { ok: true } | { ok: false; error: string };
type Created = { ok: true; id: string } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false as const, error });
const done = { ok: true as const };

const nameMax = limits.fileName;
// One action moves, stars or deletes at most this many things at once.
const batchMax = 2000;
// A delivery made from the library copies at most this many files in one go.
const sendMax = 500;

const refresh = () => revalidatePath("/explorer");

function cleanName(raw: unknown, label: string): { value: string } | { error: string } {
  if (typeof raw !== "string") return { error: `${label} is missing.` };
  const value = raw
    .replace(/[\\/\u0000-\u001f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return { error: `${label} cannot be empty.` };
  if (value.length > nameMax) return { error: `${label} can be at most ${nameMax} characters.` };
  return { value };
}

function ids(list: unknown): string[] | null {
  if (!Array.isArray(list) || list.length > batchMax) return null;
  if (!list.every(isUuid)) return null;
  return [...new Set(list as string[])];
}

function extensionOf(name: string): string | null {
  const match = /\.([A-Za-z0-9]{1,10})$/.exec(name);
  return match ? match[1].toLowerCase() : null;
}

async function ownsFolder(ownerId: string, folderId: string | null, kind: "folder" | "collection" = "folder") {
  if (folderId === null) return kind === "folder";
  if (!isUuid(folderId)) return false;
  const { rowCount } = await pool.query(`select 1 from "libraryFolder" where "id" = $1 and "ownerId" = $2 and "kind" = $3`, [
    folderId,
    ownerId,
    kind,
  ]);
  return Boolean(rowCount);
}

export async function createFolder(parentId: string | null, rawName: string, kind: "folder" | "collection" = "folder"): Promise<Created> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return fail(viewOnlyError);
  if (kind !== "folder" && kind !== "collection") return fail("That cannot be made here.");
  const name = cleanName(rawName, kind === "folder" ? "The folder name" : "The collection name");
  if ("error" in name) return fail(name.error);
  // Collections sit at the top level; folders sit in My files or inside another folder.
  const parent = kind === "collection" ? null : parentId;
  if (!(await ownsFolder(ownerId, parent))) return fail("That folder was not found.");
  const { rows } = await pool.query<{ id: string }>(
    `insert into "libraryFolder" ("ownerId", "parentId", "kind", "name") values ($1, $2, $3, $4) returning "id"`,
    [ownerId, parent, kind, name.value],
  );
  refresh();
  return { ok: true, id: rows[0].id };
}

export async function renameItem(type: "folder" | "file", id: string, rawName: string): Promise<Result> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return fail(viewOnlyError);
  if (!isUuid(id)) return fail("That was not found.");
  const name = cleanName(rawName, "The name");
  if ("error" in name) return fail(name.error);
  const table = type === "folder" ? "libraryFolder" : "libraryFile";
  const result = await pool.query(`update "${table}" set "name" = $1, "updatedAt" = now() where "id" = $2 and "ownerId" = $3`, [
    name.value,
    id,
    ownerId,
  ]);
  if (!result.rowCount) return fail("That was not found.");
  refresh();
  return done;
}

export type Selection = { fileIds: string[]; folderIds: string[] };

export async function setStarred(selection: Selection, starred: boolean): Promise<Result> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return fail(viewOnlyError);
  const files = ids(selection.fileIds);
  const folders = ids(selection.folderIds);
  if (!files || !folders) return fail("Nothing was selected.");
  await pool.query(`update "libraryFile" set "starred" = $1 where "id" = any($2::uuid[]) and "ownerId" = $3`, [
    Boolean(starred),
    files,
    ownerId,
  ]);
  await pool.query(`update "libraryFolder" set "starred" = $1 where "id" = any($2::uuid[]) and "ownerId" = $3`, [
    Boolean(starred),
    folders,
    ownerId,
  ]);
  refresh();
  return done;
}

// Moves files and folders into a folder (null = the top of My files). A folder can never go inside itself.
export async function moveItems(selection: Selection, targetId: string | null): Promise<Result> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return fail(viewOnlyError);
  const files = ids(selection.fileIds);
  const folders = ids(selection.folderIds);
  if (!files || !folders) return fail("Nothing was selected.");
  if (!(await ownsFolder(ownerId, targetId))) return fail("That folder was not found.");
  if (targetId && folders.length > 0) {
    const { rows } = await pool.query<{ id: string }>(
      `with recursive up as (
         select "id", "parentId" from "libraryFolder" where "id" = $1 and "ownerId" = $2
         union all
         select f."id", f."parentId" from "libraryFolder" f join up on f."id" = up."parentId"
       ) select "id" from up`,
      [targetId, ownerId],
    );
    if (rows.some((row) => folders.includes(row.id))) return fail("A folder cannot go inside itself.");
  }
  await pool.query(`update "libraryFile" set "folderId" = $1, "updatedAt" = now() where "id" = any($2::uuid[]) and "ownerId" = $3`, [
    targetId,
    files,
    ownerId,
  ]);
  await pool.query(
    `update "libraryFolder" set "parentId" = $1, "updatedAt" = now()
      where "id" = any($2::uuid[]) and "ownerId" = $3 and "kind" = 'folder'`,
    [targetId, folders, ownerId],
  );
  refresh();
  return done;
}

// Deletes files and folders for good, with everything inside the folders. Deleting a collection keeps its files.
export async function deleteItems(selection: Selection): Promise<Result> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return fail(viewOnlyError);
  const files = ids(selection.fileIds);
  const folders = ids(selection.folderIds);
  if (!files || !folders) return fail("Nothing was selected.");
  const stored = await pool.query<{ id: string; storageKey: string | null; thumbKey: string | null; pending: PendingUpload | null }>(
    `with recursive tree as (
       select "id" from "libraryFolder" where "id" = any($1::uuid[]) and "ownerId" = $3 and "kind" = 'folder'
       union all
       select f."id" from "libraryFolder" f join tree on f."parentId" = tree."id"
     )
     select "id", "storageKey", "thumbKey", "pending" from "libraryFile"
      where "ownerId" = $3 and ("id" = any($2::uuid[]) or "folderId" in (select "id" from tree))`,
    [folders, files, ownerId],
  );
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`delete from "libraryFile" where "id" = any($1::uuid[]) and "ownerId" = $2`, [
      stored.rows.map((row) => row.id),
      ownerId,
    ]);
    await client.query(`delete from "libraryFolder" where "id" = any($1::uuid[]) and "ownerId" = $2`, [folders, ownerId]);
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    console.error("Could not delete library items", error);
    return fail("Nothing was deleted. Try again.");
  } finally {
    client.release();
  }
  await removeStored(stored.rows.map((row) => ({ ...row, enhancedKey: null })));
  refresh();
  return done;
}

export async function addToCollection(collectionId: string, fileIds: string[]): Promise<Result> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return fail(viewOnlyError);
  const files = ids(fileIds);
  if (!files) return fail("Nothing was selected.");
  if (!(await ownsFolder(ownerId, collectionId, "collection"))) return fail("That collection was not found.");
  await pool.query(
    `insert into "libraryCollectionItem" ("collectionId", "fileId")
     select $1, "id" from "libraryFile" where "id" = any($2::uuid[]) and "ownerId" = $3
     on conflict do nothing`,
    [collectionId, files, ownerId],
  );
  await pool.query(`update "libraryFolder" set "updatedAt" = now() where "id" = $1`, [collectionId]);
  refresh();
  return done;
}

export async function removeFromCollection(collectionId: string, fileIds: string[]): Promise<Result> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return fail(viewOnlyError);
  const files = ids(fileIds);
  if (!files) return fail("Nothing was selected.");
  if (!(await ownsFolder(ownerId, collectionId, "collection"))) return fail("That collection was not found.");
  await pool.query(`delete from "libraryCollectionItem" where "collectionId" = $1 and "fileId" = any($2::uuid[])`, [collectionId, files]);
  refresh();
  return done;
}

// Runs copies a few at a time, so a big folder does not open hundreds of requests to storage at once.
async function inBatches<T, R>(items: T[], size: number, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let start = 0; start < items.length; start += size) {
    results.push(...(await Promise.all(items.slice(start, start + size).map(work))));
  }
  return results;
}

// A thumbnail that fails to copy just leaves the copy with an icon instead of a picture.
async function copyThumb(from: string, to: string): Promise<string | null> {
  try {
    await copyObject(from, to);
    return to;
  } catch {
    return null;
  }
}

async function roomFor(ownerId: string, bytes: number) {
  return (await storageUsed(ownerId)) + bytes <= storageLimits.accountBytes;
}

// Copies files that are already in deliveries into My files, so earlier work can be organised here too.
export async function copyToLibrary(deliveryFileIds: string[], folderId: string | null): Promise<Result> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return fail(viewOnlyError);
  const files = ids(deliveryFileIds);
  if (!files || files.length === 0 || files.length > sendMax) return fail("Nothing was selected.");
  if (!storageConfigured()) return fail("File storage is not connected yet.");
  if (!(await ownsFolder(ownerId, folderId))) return fail("That folder was not found.");
  const { rows } = await pool.query<{
    name: string;
    ext: string | null;
    sizeBytes: string;
    mimeType: string | null;
    storageKey: string;
    thumbKey: string | null;
  }>(
    `select f."name", f."ext", f."sizeBytes", f."mimeType", f."storageKey", f."thumbKey"
       from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"
      where f."id" = any($1::uuid[]) and d."ownerId" = $2 and f."storageKey" is not null`,
    [files, ownerId],
  );
  const total = rows.reduce((sum, row) => sum + Number(row.sizeBytes), 0);
  if (!(await roomFor(ownerId, total))) return fail(`This would pass your ${formatSize(storageLimits.accountBytes)} of storage.`);
  try {
    await inBatches(rows, 6, async (row) => {
      const id = randomUUID();
      const key = newLibraryKey(ownerId, id);
      await copyObject(row.storageKey, key);
      const thumbKey = row.thumbKey ? await copyThumb(row.thumbKey, `${key}-thumb`) : null;
      await pool.query(
        `insert into "libraryFile" ("id", "ownerId", "folderId", "name", "ext", "sizeBytes", "mimeType", "storageKey", "thumbKey")
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [id, ownerId, folderId, row.ext ? `${row.name}.${row.ext}` : row.name, row.ext, row.sizeBytes, row.mimeType, key, thumbKey],
      );
    });
  } catch (error) {
    console.error("Could not copy delivery files to the library", error);
    refresh();
    return fail("Some files could not be copied. Try again.");
  }
  refresh();
  return done;
}

export type SendInput = { title: string; sections: { title: string; fileIds: string[] }[] };

// Makes a draft delivery from library files: each group becomes a section, and every file is copied inside storage,
// so the delivery and the library can each change or delete their copy without touching the other.
export async function sendAsDelivery(input: SendInput): Promise<Created> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return fail(viewOnlyError);
  if (!storageConfigured()) return fail("File storage is not connected yet.");
  const title = cleanName(input?.title, "The delivery name");
  if ("error" in title) return fail(title.error);
  if (title.value.length > limits.title) return fail(`The delivery name can be at most ${limits.title} characters.`);
  const sections = Array.isArray(input.sections) ? input.sections.slice(0, 50) : [];
  const wanted = sections.map((section) => ({
    title: (typeof section.title === "string" ? section.title.trim() : "").slice(0, limits.title) || "Files",
    fileIds: ids(section.fileIds) ?? [],
  }));
  const all = [...new Set(wanted.flatMap((section) => section.fileIds))];
  if (all.length === 0) return fail("There are no files to send.");
  if (all.length > sendMax) return fail(`A delivery can be made from up to ${sendMax} files at a time.`);

  const { rows } = await pool.query<{
    id: string;
    name: string;
    ext: string | null;
    sizeBytes: string;
    mimeType: string | null;
    storageKey: string;
    thumbKey: string | null;
  }>(
    `select "id", "name", "ext", "sizeBytes", "mimeType", "storageKey", "thumbKey" from "libraryFile"
      where "id" = any($1::uuid[]) and "ownerId" = $2 and "storageKey" is not null`,
    [all, ownerId],
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  const total = rows.reduce((sum, row) => sum + Number(row.sizeBytes), 0);
  if (!(await roomFor(ownerId, total))) return fail(`This would pass your ${formatSize(storageLimits.accountBytes)} of storage.`);

  const deliveryId = await createDeliveryRow(ownerId, title.value, null);
  const first = await pool.query<{ id: string }>(`select "id" from "deliverySection" where "deliveryId" = $1 limit 1`, [deliveryId]);
  const made: string[] = [];
  try {
    for (const [index, section] of wanted.entries()) {
      const files = section.fileIds.map((id) => byId.get(id)).filter((row) => row !== undefined);
      if (files.length === 0) continue;
      let sectionId = first.rows[0].id;
      if (index === 0) {
        await pool.query(`update "deliverySection" set "title" = $1 where "id" = $2`, [section.title, sectionId]);
      } else {
        const created = await pool.query<{ id: string }>(
          `insert into "deliverySection" ("deliveryId", "title", "position") values ($1, $2, $3) returning "id"`,
          [deliveryId, section.title, index],
        );
        sectionId = created.rows[0].id;
      }
      await inBatches(
        files.map((file, position) => ({ file, position })),
        6,
        async ({ file, position }) => {
          const id = randomUUID();
          const key = newObjectKey(deliveryId, id);
          await copyObject(file.storageKey, key);
          made.push(key);
          const thumbKey = file.thumbKey ? await copyThumb(file.thumbKey, `${key}-thumb`) : null;
          if (thumbKey) made.push(thumbKey);
          // Delivery files carry their name without the extension, which is shown beside it.
          const label =
            file.ext && file.name.toLowerCase().endsWith(`.${file.ext}`) ? file.name.slice(0, -(file.ext.length + 1)) : file.name;
          await pool.query(
            `insert into "deliveryFile" ("id", "sectionId", "name", "position", "sizeBytes", "mimeType", "ext", "storageKey", "thumbKey")
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
            [id, sectionId, label.slice(0, limits.fileName), position, file.sizeBytes, file.mimeType, file.ext, key, thumbKey],
          );
        },
      );
    }
  } catch (error) {
    console.error("Could not make a delivery from library files", error);
    await pool.query(`delete from "delivery" where "id" = $1 and "ownerId" = $2`, [deliveryId, ownerId]);
    await deleteObjects(made);
    return fail("The files could not be copied into a delivery. Try again.");
  }
  revalidatePath("/deliveries");
  revalidatePath("/dashboard");
  refresh();
  return { ok: true, id: deliveryId };
}

// Uploads into the library use the same browser code as delivery uploads: a signed PUT (or parts for big files),
// then the server checks the object before the file shows up.

export type BeginLibraryUploadInput = {
  folderId: string | null;
  collectionId?: string | null;
  name: string;
  size: number;
  type: string;
  thumbSize?: number;
};

const typePattern = /^[a-z0-9][a-z0-9!#$&^_.+-]{0,126}\/[a-z0-9][a-z0-9!#$&^_.+-]{0,126}$/i;

function partSizes(size: number): number[] {
  const part = partSizeFor(size);
  const sizes: number[] = [];
  for (let offset = 0; offset < size; offset += part) sizes.push(Math.min(part, size - offset));
  return sizes;
}

export async function beginLibraryUpload(input: BeginLibraryUploadInput): Promise<BeginUploadResult> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return fail(viewOnlyError);
  if (!storageConfigured()) return fail("File storage is not connected yet.");
  const size = input.size;
  if (!Number.isSafeInteger(size) || size < 1) return fail("This file is empty.");
  if (size > storageLimits.maxFileBytes) return fail(`Files can be up to ${formatSize(storageLimits.maxFileBytes)} for now.`);
  const raw = typeof input.name === "string" ? (input.name.split(/[\\/]/).pop() ?? "") : "";
  const name = cleanName(raw, "The file name");
  if ("error" in name) return fail(name.error);
  if (!(await ownsFolder(ownerId, input.folderId ?? null))) return fail("That folder was not found.");
  const collectionId = input.collectionId ?? null;
  if (collectionId && !(await ownsFolder(ownerId, collectionId, "collection"))) return fail("That collection was not found.");
  if (!(await roomFor(ownerId, size))) {
    return fail(`This would pass your ${formatSize(storageLimits.accountBytes)} of storage. Remove a file or upload less.`);
  }
  const type = typePattern.test(input.type) ? input.type.toLowerCase() : "application/octet-stream";

  const fileId = randomUUID();
  const key = newLibraryKey(ownerId, fileId);
  const multipart = size > storageLimits.singleUploadMaxBytes;
  const thumbSize =
    typeof input.thumbSize === "number" &&
    Number.isSafeInteger(input.thumbSize) &&
    input.thumbSize > 0 &&
    input.thumbSize <= storageLimits.thumbMaxBytes
      ? input.thumbSize
      : null;
  const thumbKey = thumbSize ? `${key}-thumb` : undefined;
  const ext = extensionOf(name.value);

  let uploadId: string | null = null;
  try {
    if (multipart) uploadId = await startMultipart(key, type);
    const pending: PendingUpload & { collectionId?: string } = {
      key,
      uploadId,
      size,
      type,
      ext,
      at: new Date().toISOString(),
      ...(thumbKey && thumbSize ? { thumbKey, thumbSize } : {}),
      ...(collectionId ? { collectionId } : {}),
    };
    await pool.query(`insert into "libraryFile" ("id", "ownerId", "folderId", "name", "ext", "pending") values ($1, $2, $3, $4, $5, $6)`, [
      fileId,
      ownerId,
      input.folderId ?? null,
      name.value,
      ext,
      JSON.stringify(pending),
    ]);
    const thumbUrl = thumbKey && thumbSize ? await presignPut(thumbKey, "image/jpeg", thumbSize) : null;
    if (!multipart) return { ok: true, fileId, contentType: type, singleUrl: await presignPut(key, type, size), parts: [], thumbUrl };
    const parts = await Promise.all(
      partSizes(size).map(async (partSize, index) => ({
        number: index + 1,
        size: partSize,
        url: await presignPart(key, uploadId as string, index + 1, partSize),
      })),
    );
    return { ok: true, fileId, contentType: type, singleUrl: null, parts, thumbUrl };
  } catch (error) {
    console.error("Could not start a library upload", error);
    if (uploadId) await discardPending({ key, uploadId, size, type, ext: null, at: "", thumbKey });
    await pool.query(`delete from "libraryFile" where "id" = $1 and "ownerId" = $2`, [fileId, ownerId]);
    return fail("Storage did not respond. Try again in a moment.");
  }
}

export async function completeLibraryUpload(fileId: string): Promise<Result> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return fail(viewOnlyError);
  if (!isUuid(fileId)) return fail("This file was not found.");
  const { rows } = await pool.query<{ pending: (PendingUpload & { collectionId?: string }) | null }>(
    `select "pending" from "libraryFile" where "id" = $1 and "ownerId" = $2`,
    [fileId, ownerId],
  );
  const pending = rows[0]?.pending;
  if (!pending) return fail("There is no upload in progress for this file.");
  let thumbKey: string | null = null;
  try {
    if (pending.uploadId) {
      const joined = await completeMultipart(pending.key, pending.uploadId, partSizes(pending.size));
      if (!joined) return fail("Some of the file did not arrive. Try the upload again.");
    }
    const stored = await headObject(pending.key);
    if (!stored || stored.size !== pending.size) {
      await discardPending(pending);
      await pool.query(`delete from "libraryFile" where "id" = $1`, [fileId]);
      return fail("The upload did not finish. Try again.");
    }
    if (pending.thumbKey && pending.thumbSize) {
      const thumb = await headObject(pending.thumbKey);
      if (thumb && thumb.size === pending.thumbSize) thumbKey = pending.thumbKey;
      else await deleteObjects([pending.thumbKey]);
    }
  } catch (error) {
    console.error("Could not finish a library upload", error);
    return fail("Storage did not respond. Try again in a moment.");
  }
  await pool.query(
    `update "libraryFile" set "storageKey" = $1, "sizeBytes" = $2, "mimeType" = $3, "thumbKey" = $4, "pending" = null, "updatedAt" = now()
      where "id" = $5 and "pending"->>'key' = $1`,
    [pending.key, pending.size, pending.type, thumbKey, fileId],
  );
  if (pending.collectionId) {
    await pool.query(
      `insert into "libraryCollectionItem" ("collectionId", "fileId")
       select $1, $2 where exists (select 1 from "libraryFolder" where "id" = $1 and "ownerId" = $3)
       on conflict do nothing`,
      [pending.collectionId, fileId, ownerId],
    );
  }
  refresh();
  return done;
}

export async function abortLibraryUpload(fileId: string): Promise<Result> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return fail(viewOnlyError);
  if (!isUuid(fileId)) return fail("This file was not found.");
  const { rows } = await pool.query<{ pending: PendingUpload | null; storageKey: string | null }>(
    `select "pending", "storageKey" from "libraryFile" where "id" = $1 and "ownerId" = $2`,
    [fileId, ownerId],
  );
  if (!rows[0]) return fail("This file was not found.");
  if (rows[0].pending) await discardPending(rows[0].pending);
  if (!rows[0].storageKey) await pool.query(`delete from "libraryFile" where "id" = $1`, [fileId]);
  return done;
}
