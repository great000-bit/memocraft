"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { pool } from "./auth";
import { limits } from "./delivery-limits";
import { createDeliveryRow, isUuid } from "./deliveries";
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
  redirect(`/deliveries/${id}`);
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

type StoredFile = { storageKey: string | null; pending: PendingUpload | null };

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
    `select "storageKey", "pending" from "deliveryFile" where "sectionId" = $1`,
    [sectionId],
  );
  await pool.query(`delete from "deliverySection" where "id" = $1`, [sectionId]);
  await pool.query(`update "delivery" set "updatedAt" = now() where "id" = $1`, [deliveryId]);
  await removeStored(files.rows);
  refresh(deliveryId);
  return done;
}

export async function deleteFile(fileId: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!isUuid(fileId)) return fail("This file was not found.");
  const file = await pool.query<StoredFile & { deliveryId: string }>(
    `select f."storageKey", f."pending", s."deliveryId"
       from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"
      where f."id" = $1 and d."ownerId" = $2`,
    [fileId, user.id],
  );
  const row = file.rows[0];
  if (!row) return fail("This file was not found.");
  await pool.query(`delete from "deliveryFile" where "id" = $1`, [fileId]);
  await pool.query(`update "delivery" set "updatedAt" = now() where "id" = $1`, [row.deliveryId]);
  await removeStored([row]);
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
