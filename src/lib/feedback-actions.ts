"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { pool } from "./auth";
import { getPublishedRef, isUuid } from "./deliveries";
import { describeDevice, isOwner } from "./delivery-events";
import { limits } from "./delivery-limits";
import { passesPassword } from "./link-access";
import { notifyOwner } from "./push";
import { requireUser } from "./session";

export type FeedbackResult = { ok: true; at?: string } | { ok: false; error: string };

const fail = (error: string): FeedbackResult => ({ ok: false, error });

// Per delivery and hour. Nothing identifies a client, so the limits are on the link: plenty for a real review,
// not enough for a script to bury the creative.
const perHour = { approval: 60, comment: 40, favourite: 400 } as const;

const keyPattern = /^[A-Za-z0-9-]{8,64}$/;

type Target = { id: string; ownerId: string; device: string };

// Everything a client does here goes through the same door as the page itself: a live link, the password when it
// has one, and a real browser. The signed-in sender is turned away, so their own tests never land in the record.
async function clientTarget(slug: unknown, clientKey: unknown): Promise<Target | { error: string }> {
  const ref = await getPublishedRef(typeof slug === "string" ? slug : "");
  if (!ref || !(await passesPassword(ref.id, ref.passwordHash))) return { error: "This link is not available." };
  if (typeof clientKey !== "string" || !keyPattern.test(clientKey)) return { error: "Reload the page and try again." };
  const requestHeaders = await headers();
  const device = describeDevice(requestHeaders);
  if (!device) return { error: "This browser cannot do that." };
  if (await isOwner(requestHeaders, ref.ownerId)) return { error: "You are signed in as the sender. Your client does this from their own phone or computer." };
  return { id: ref.id, ownerId: ref.ownerId, device };
}

type FileRef = { name: string; sizeBytes: string | null; replacedAt: Date | null };

async function fileIn(deliveryId: string, fileId: unknown): Promise<(FileRef & { id: string }) | null> {
  if (!isUuid(fileId)) return null;
  const { rows } = await pool.query<FileRef>(
    `select f."name", f."sizeBytes", f."replacedAt" from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
      where f."id" = $1 and s."deliveryId" = $2 and f."storageKey" is not null`,
    [fileId, deliveryId],
  );
  return rows[0] ? { ...rows[0], id: fileId } : null;
}

async function recent(table: "approval" | "fileComment" | "fileFavourite", deliveryId: string): Promise<number> {
  const column = table === "approval" || table === "fileFavourite" ? "at" : "createdAt";
  const { rows } = await pool.query<{ n: number }>(
    `select count(*)::int as "n" from "${table}" where "deliveryId" = $1 and "${column}" > now() - interval '1 hour'`,
    [deliveryId],
  );
  return rows[0].n;
}

function cleanName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().replace(/\s+/g, " ");
  return trimmed ? trimmed.slice(0, limits.clientName) : null;
}

function refreshOwner(deliveryId: string) {
  revalidatePath(`/deliveries/${deliveryId}`);
  revalidatePath("/dashboard");
}

// The client approves one file, or the whole delivery when fileId is empty. Each tap is a new dated row, never an
// edit, so the record shows exactly what was approved and when.
export async function approve(slug: string, clientKey: string, fileId: string | null, name: string): Promise<FeedbackResult> {
  const target = await clientTarget(slug, clientKey);
  if ("error" in target) return fail(target.error);
  let file: (FileRef & { id: string }) | null = null;
  if (fileId) {
    file = await fileIn(target.id, fileId);
    if (!file) return fail("That file was not found.");
  }
  if ((await recent("approval", target.id)) >= perHour.approval) return fail("Too many approvals in a short time. Try again later.");
  const { rows } = await pool.query<{ at: Date }>(
    `insert into "approval" ("deliveryId", "fileId", "fileName", "fileSize", "fileVersionAt", "name", "clientKey", "device")
     values ($1, $2, $3, $4, $5, $6, $7, $8) returning "at"`,
    [target.id, file?.id ?? null, file?.name ?? null, file?.sizeBytes ?? null, file?.replacedAt ?? null, cleanName(name), clientKey, target.device],
  );
  refreshOwner(target.id);
  notifyOwner(target.id, "approval", file?.name ?? null);
  return { ok: true, at: rows[0].at.toISOString() };
}

// A heart on a file. One per browser; tapping again takes it back.
export async function setFavourite(slug: string, clientKey: string, fileId: string, on: boolean): Promise<FeedbackResult> {
  const target = await clientTarget(slug, clientKey);
  if ("error" in target) return fail(target.error);
  const file = await fileIn(target.id, fileId);
  if (!file) return fail("That file was not found.");
  if (on) {
    if ((await recent("fileFavourite", target.id)) >= perHour.favourite) return fail("Too many hearts in a short time. Try again later.");
    await pool.query(
      `insert into "fileFavourite" ("fileId", "deliveryId", "clientKey") values ($1, $2, $3) on conflict do nothing`,
      [file.id, target.id, clientKey],
    );
  } else {
    await pool.query(`delete from "fileFavourite" where "fileId" = $1 and "clientKey" = $2`, [file.id, clientKey]);
  }
  refreshOwner(target.id);
  return { ok: true };
}

const coordinate = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null;

// A note on a file, pinned to a spot on its picture when x and y are given.
export async function addComment(
  slug: string,
  clientKey: string,
  fileId: string,
  input: { message: string; x?: number | null; y?: number | null; name?: string },
): Promise<FeedbackResult> {
  const target = await clientTarget(slug, clientKey);
  if ("error" in target) return fail(target.error);
  const file = await fileIn(target.id, fileId);
  if (!file) return fail("That file was not found.");
  const message = typeof input?.message === "string" ? input.message.trim() : "";
  if (message.length < 2) return fail("Write a few words first.");
  if (message.length > limits.comment) return fail(`Keep it under ${limits.comment} characters.`);
  const x = coordinate(input.x);
  const y = coordinate(input.y);
  if ((await recent("fileComment", target.id)) >= perHour.comment) return fail("Too many comments in a short time. Try again later.");
  await pool.query(
    `insert into "fileComment" ("deliveryId", "fileId", "message", "x", "y", "name", "clientKey")
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [target.id, file.id, message, x === null || y === null ? null : x, x === null || y === null ? null : y, cleanName(input.name), clientKey],
  );
  refreshOwner(target.id);
  notifyOwner(target.id, "comment", file.name);
  return { ok: true };
}

// The creative answers a comment. The reply shows under the client's note on the client page.
export async function replyToComment(commentId: string, message: string): Promise<FeedbackResult> {
  const user = await requireUser();
  if (!isUuid(commentId)) return fail("This comment was not found.");
  const text = typeof message === "string" ? message.trim() : "";
  if (text.length < 1) return fail("Write your reply first.");
  if (text.length > limits.comment) return fail(`Keep it under ${limits.comment} characters.`);
  const { rows } = await pool.query<{ deliveryId: string }>(
    `insert into "fileComment" ("deliveryId", "fileId", "message", "fromOwner", "parentId")
     select c."deliveryId", c."fileId", $2, true, c."id"
       from "fileComment" c join "delivery" d on d."id" = c."deliveryId"
      where c."id" = $1 and d."ownerId" = $3 and not c."fromOwner"
     returning "deliveryId"`,
    [commentId, text, user.id],
  );
  if (!rows[0]) return fail("This comment was not found.");
  refreshOwner(rows[0].deliveryId);
  return { ok: true };
}

// The creative marks a comment handled, or opens it again.
export async function setCommentResolved(commentId: string, resolved: boolean): Promise<FeedbackResult> {
  const user = await requireUser();
  if (!isUuid(commentId)) return fail("This comment was not found.");
  const { rows } = await pool.query<{ deliveryId: string }>(
    `update "fileComment" c set "resolvedAt" = case when $2::boolean then now() else null end
       from "delivery" d
      where c."id" = $1 and d."id" = c."deliveryId" and d."ownerId" = $3
      returning c."deliveryId"`,
    [commentId, resolved, user.id],
  );
  if (!rows[0]) return fail("This comment was not found.");
  refreshOwner(rows[0].deliveryId);
  return { ok: true };
}
