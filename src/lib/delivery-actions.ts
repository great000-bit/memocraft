"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { pool } from "./auth";
import { limits } from "./delivery-limits";
import { createDeliveryRow, isUuid } from "./deliveries";
import { hashPassword, passwordProblem } from "./link-access";
import { requireUser } from "./session";
import { removeStored, type PendingUpload } from "./storage";

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (error: string): ActionResult => ({ ok: false, error });
const done: ActionResult = { ok: true };

type FieldRule = { column: string; max: number; required?: boolean; label: string };

const deliveryFields: Record<string, FieldRule> = {
  title: { column: "title", max: limits.title, required: true, label: "The title" },
  clientName: { column: "clientName", max: limits.clientName, label: "The client name" },
  message: { column: "message", max: limits.message, label: "The message" },
};

const sectionFields: Record<string, FieldRule> = {
  title: { column: "title", max: limits.title, required: true, label: "The section name" },
  note: { column: "note", max: limits.note, label: "The note" },
};

const fileFields: Record<string, FieldRule> = {
  name: { column: "name", max: limits.fileName, required: true, label: "The file name" },
  note: { column: "note", max: limits.note, label: "The note" },
};

const ruleFor = (rules: Record<string, FieldRule>, field: string) => (Object.hasOwn(rules, field) ? rules[field] : undefined);

// Returns the cleaned value, or an error message. Empty optional fields are stored as null.
function clean(value: unknown, rule: FieldRule): { value: string | null } | { error: string } {
  if (typeof value !== "string") return { error: `${rule.label} is missing.` };
  const trimmed = value.trim();
  if (!trimmed) return rule.required ? { error: `${rule.label} cannot be empty.` } : { value: null };
  if (trimmed.length > rule.max) return { error: `${rule.label} can be at most ${rule.max} characters.` };
  return { value: trimmed };
}

function refresh(deliveryId: string) {
  revalidatePath(`/deliveries/${deliveryId}`);
  revalidatePath("/dashboard");
  revalidatePath("/deliveries");
}

export async function createDelivery(_previous: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const title = clean(formData.get("title"), deliveryFields.title);
  if ("error" in title) return fail(title.error);
  const client = clean(formData.get("clientName"), deliveryFields.clientName);
  if ("error" in client) return fail(client.error);
  const id = await createDeliveryRow(user.id, title.value as string, client.value);
  // The editor opens with a "Delivery created" pop-up; it drops the flag from the address once it has shown.
  redirect(`/deliveries/${id}?created=1`);
}

// Every action below checks ownership in SQL: the row is only touched when it belongs to the signed-in user.

export async function saveDeliveryField(deliveryId: string, field: string, input: string): Promise<ActionResult> {
  const user = await requireUser();
  const rule = ruleFor(deliveryFields, field);
  if (!rule || !isUuid(deliveryId)) return fail("That field cannot be edited.");
  const cleaned = clean(input, rule);
  if ("error" in cleaned) return fail(cleaned.error);
  const result = await pool.query(
    `update "delivery" set "${rule.column}" = $1, "updatedAt" = now() where "id" = $2 and "ownerId" = $3`,
    [cleaned.value, deliveryId, user.id],
  );
  if (!result.rowCount) return fail("This delivery was not found.");
  revalidatePath("/dashboard");
  revalidatePath("/deliveries");
  return done;
}

export async function saveSectionField(sectionId: string, field: string, input: string): Promise<ActionResult> {
  const user = await requireUser();
  const rule = ruleFor(sectionFields, field);
  if (!rule || !isUuid(sectionId)) return fail("That field cannot be edited.");
  const cleaned = clean(input, rule);
  if ("error" in cleaned) return fail(cleaned.error);
  const result = await pool.query(
    `with target as (
       select s."id", s."deliveryId" from "deliverySection" s
         join "delivery" d on d."id" = s."deliveryId"
        where s."id" = $2 and d."ownerId" = $3
     ), changed as (
       update "deliverySection" s set "${rule.column}" = $1 from target where s."id" = target."id" returning s."id"
     )
     update "delivery" d set "updatedAt" = now() from target where d."id" = target."deliveryId"`,
    [cleaned.value, sectionId, user.id],
  );
  if (!result.rowCount) return fail("This section was not found.");
  return done;
}

export async function saveFileField(fileId: string, field: string, input: string): Promise<ActionResult> {
  const user = await requireUser();
  const rule = ruleFor(fileFields, field);
  if (!rule || !isUuid(fileId)) return fail("That field cannot be edited.");
  const cleaned = clean(input, rule);
  if ("error" in cleaned) return fail(cleaned.error);
  const result = await pool.query(
    `with target as (
       select f."id", s."deliveryId" from "deliveryFile" f
         join "deliverySection" s on s."id" = f."sectionId"
         join "delivery" d on d."id" = s."deliveryId"
        where f."id" = $2 and d."ownerId" = $3
     ), changed as (
       update "deliveryFile" f set "${rule.column}" = $1 from target where f."id" = target."id" returning f."id"
     )
     update "delivery" d set "updatedAt" = now() from target where d."id" = target."deliveryId"`,
    [cleaned.value, fileId, user.id],
  );
  if (!result.rowCount) return fail("This file was not found.");
  return done;
}

export async function addSection(deliveryId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isUuid(deliveryId)) return fail("This delivery was not found.");
  const result = await pool.query(
    `with owned as (select "id" from "delivery" where "id" = $1 and "ownerId" = $2),
          added as (
            insert into "deliverySection" ("deliveryId", "title", "position")
            select o."id", 'New section',
                   coalesce((select max("position") + 1 from "deliverySection" where "deliveryId" = o."id"), 0)
              from owned o returning "deliveryId"
          )
     update "delivery" d set "updatedAt" = now() from added where d."id" = added."deliveryId"`,
    [deliveryId, user.id],
  );
  if (!result.rowCount) return fail("This delivery was not found.");
  refresh(deliveryId);
  return done;
}

type StoredFile = { storageKey: string | null; thumbKey: string | null; pending: PendingUpload | null };

// Earlier versions live in their own table and are removed from the database with their file, so the objects they
// point to are collected first and cleared from storage together with the file's own.
type StoredVersion = { storageKey: string; thumbKey: string | null };
const asStored = (version: StoredVersion): StoredFile => ({ storageKey: version.storageKey, thumbKey: version.thumbKey, pending: null });

export async function deleteSection(sectionId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isUuid(sectionId)) return fail("This section was not found.");
  const section = await pool.query<{ deliveryId: string }>(
    `select s."deliveryId" from "deliverySection" s join "delivery" d on d."id" = s."deliveryId"
      where s."id" = $1 and d."ownerId" = $2`,
    [sectionId, user.id],
  );
  const deliveryId = section.rows[0]?.deliveryId;
  if (!deliveryId) return fail("This section was not found.");
  const files = await pool.query<StoredFile>(
    `select "storageKey", "thumbKey", "pending" from "deliveryFile" where "sectionId" = $1`,
    [sectionId],
  );
  const versions = await pool.query<StoredVersion>(
    `select v."storageKey", v."thumbKey" from "deliveryFileVersion" v join "deliveryFile" f on f."id" = v."fileId"
      where f."sectionId" = $1`,
    [sectionId],
  );
  await pool.query(`delete from "deliverySection" where "id" = $1`, [sectionId]);
  await pool.query(`update "delivery" set "updatedAt" = now() where "id" = $1`, [deliveryId]);
  await removeStored([...files.rows, ...versions.rows.map(asStored)]);
  refresh(deliveryId);
  return done;
}

export async function deleteFile(fileId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isUuid(fileId)) return fail("This file was not found.");
  const file = await pool.query<StoredFile & { deliveryId: string }>(
    `select f."storageKey", f."thumbKey", f."pending", s."deliveryId"
       from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"
      where f."id" = $1 and d."ownerId" = $2`,
    [fileId, user.id],
  );
  const row = file.rows[0];
  if (!row) return fail("This file was not found.");
  const versions = await pool.query<StoredVersion>(`select "storageKey", "thumbKey" from "deliveryFileVersion" where "fileId" = $1`, [fileId]);
  await pool.query(`delete from "deliveryFile" where "id" = $1`, [fileId]);
  await pool.query(`update "delivery" set "updatedAt" = now() where "id" = $1`, [row.deliveryId]);
  await removeStored([row, ...versions.rows.map(asStored)]);
  refresh(row.deliveryId);
  return done;
}

export async function setPublished(deliveryId: string, published: boolean): Promise<ActionResult> {
  const user = await requireUser();
  if (!isUuid(deliveryId)) return fail("This delivery was not found.");
  const result = await pool.query(
    `update "delivery"
        set "status" = $1, "updatedAt" = now(), "publishedAt" = case when $2 then coalesce("publishedAt", now()) else "publishedAt" end
      where "id" = $3 and "ownerId" = $4`,
    [published ? "published" : "draft", published, deliveryId, user.id],
  );
  if (!result.rowCount) return fail("This delivery was not found.");
  refresh(deliveryId);
  return done;
}

const longestExpiryDays = 5 * 366;

// The browser sends the end of the day the creative picked, in their own time zone, as an ISO time. Null removes it.
export async function setLinkExpiry(deliveryId: string, expiresAt: string | null): Promise<ActionResult> {
  const user = await requireUser();
  if (!isUuid(deliveryId)) return fail("This delivery was not found.");
  let when: Date | null = null;
  if (expiresAt !== null) {
    when = typeof expiresAt === "string" ? new Date(expiresAt) : null;
    if (!when || Number.isNaN(when.getTime())) return fail("Pick a valid date.");
    if (when.getTime() <= Date.now()) return fail("Pick a date that has not passed yet.");
    if (when.getTime() > Date.now() + longestExpiryDays * 24 * 60 * 60 * 1000) return fail("Pick a date within the next five years.");
  }
  const result = await pool.query(`update "delivery" set "expiresAt" = $1 where "id" = $2 and "ownerId" = $3`, [
    when,
    deliveryId,
    user.id,
  ]);
  if (!result.rowCount) return fail("This delivery was not found.");
  refresh(deliveryId);
  return done;
}

// Null removes the password. A new password also clears any lock left by wrong guesses on the old one.
export async function setLinkPassword(deliveryId: string, password: string | null): Promise<ActionResult> {
  const user = await requireUser();
  if (!isUuid(deliveryId)) return fail("This delivery was not found.");
  let hash: string | null = null;
  if (password !== null) {
    if (typeof password !== "string") return fail("The password is missing.");
    const problem = passwordProblem(password);
    if (problem) return fail(problem);
    hash = await hashPassword(password);
  }
  const result = await pool.query(
    `update "delivery" set "passwordHash" = $1, "passwordFailures" = 0, "passwordLockedUntil" = null
      where "id" = $2 and "ownerId" = $3`,
    [hash, deliveryId, user.id],
  );
  if (!result.rowCount) return fail("This delivery was not found.");
  refresh(deliveryId);
  return done;
}

// A note about what changed, shown to the client above the files. The link stays the same.
export async function postUpdate(deliveryId: string, note: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isUuid(deliveryId)) return fail("This delivery was not found.");
  const cleaned = clean(note, { column: "note", max: limits.update, required: true, label: "The update" });
  if ("error" in cleaned) return fail(cleaned.error);
  const result = await pool.query(
    `insert into "deliveryUpdate" ("deliveryId", "note")
     select d."id", $1 from "delivery" d where d."id" = $2 and d."ownerId" = $3`,
    [cleaned.value, deliveryId, user.id],
  );
  if (!result.rowCount) return fail("This delivery was not found.");
  refresh(deliveryId);
  return done;
}

export async function deleteUpdate(updateId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isUuid(updateId)) return fail("This update was not found.");
  const result = await pool.query<{ deliveryId: string }>(
    `delete from "deliveryUpdate" u using "delivery" d
      where u."id" = $1 and d."id" = u."deliveryId" and d."ownerId" = $2
      returning u."deliveryId"`,
    [updateId, user.id],
  );
  if (!result.rows[0]) return fail("This update was not found.");
  refresh(result.rows[0].deliveryId);
  return done;
}

// Removes the delivery, its files and everything a client did on it, and clears the files from storage. The editor
// asks twice before calling this.
export async function deleteDelivery(deliveryId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isUuid(deliveryId)) return fail("This delivery was not found.");
  const owned = await pool.query(`select 1 from "delivery" where "id" = $1 and "ownerId" = $2`, [deliveryId, user.id]);
  if (!owned.rowCount) return fail("This delivery was not found.");
  const files = await pool.query<StoredFile>(
    `select f."storageKey", f."thumbKey", f."pending"
       from "deliveryFile" f join "deliverySection" s on s."id" = f."sectionId"
      where s."deliveryId" = $1`,
    [deliveryId],
  );
  const versions = await pool.query<StoredVersion>(
    `select v."storageKey", v."thumbKey"
       from "deliveryFileVersion" v
       join "deliveryFile" f on f."id" = v."fileId"
       join "deliverySection" s on s."id" = f."sectionId"
      where s."deliveryId" = $1`,
    [deliveryId],
  );
  const removed = await pool.query(`delete from "delivery" where "id" = $1 and "ownerId" = $2`, [deliveryId, user.id]);
  if (!removed.rowCount) return fail("This delivery was not found.");
  await removeStored([...files.rows, ...versions.rows.map(asStored)]);
  revalidatePath("/dashboard");
  revalidatePath("/deliveries");
  redirect("/deliveries");
}
