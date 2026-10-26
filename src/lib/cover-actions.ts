"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import sharp from "sharp";
import { pool } from "./auth";
import { coverLimits, isCoverTemplate, type CoverTemplateId } from "./cover";
import { limits } from "./delivery-limits";
import { isUuid } from "./deliveries";
import type { ActionResult } from "./delivery-actions";
import { editableOwnerId, viewOnlyError } from "./team";
import { deleteObjects, getObject, presignThumb, putObject, storageConfigured } from "./storage";

export type CoverInput = {
  template: CoverTemplateId;
  title: string;
  kicker: string;
  subtitle: string;
  button: string;
  focusX: number;
  focusY: number;
};

const fail = (error: string): ActionResult => ({ ok: false, error });

function line(value: unknown, max: number, label: string): string | { error: string } {
  if (typeof value !== "string") return { error: `${label} is missing.` };
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (trimmed.length > max) return { error: `${label} can be at most ${max} characters.` };
  return trimmed;
}

const percent = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : 50);

// The designer saves everything it shows in one go: the template, the title (the delivery's own) and the cover's words.
// The cover picture is not part of it; only setCoverPhoto makes and stores that.
export async function saveCover(deliveryId: string, input: CoverInput): Promise<ActionResult> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return fail(viewOnlyError);
  if (!isUuid(deliveryId) || !input || typeof input !== "object") return fail("This delivery was not found.");
  if (!isCoverTemplate(input.template)) return fail("Pick one of the templates.");
  const title = line(input.title, limits.title, "The title");
  if (typeof title !== "string") return fail(title.error);
  if (!title) return fail("The title cannot be empty.");
  const kicker = line(input.kicker, coverLimits.kicker, "The top line");
  if (typeof kicker !== "string") return fail(kicker.error);
  const subtitle = line(input.subtitle, coverLimits.subtitle, "The date line");
  if (typeof subtitle !== "string") return fail(subtitle.error);
  const button = line(input.button, coverLimits.button, "The button");
  if (typeof button !== "string") return fail(button.error);
  const words = { template: input.template, kicker, subtitle, button, focusX: percent(input.focusX), focusY: percent(input.focusY) };
  const result = await pool.query(
    `update "delivery" set "title" = $1, "cover" = coalesce("cover", '{}'::jsonb) || $2::jsonb, "updatedAt" = now()
      where "id" = $3 and "ownerId" = $4`,
    [title, JSON.stringify(words), deliveryId, ownerId],
  );
  if (!result.rowCount) return fail("This delivery was not found.");
  revalidatePath("/dashboard");
  revalidatePath("/deliveries");
  return { ok: true };
}

// Photos larger than this stay on their small preview as a cover: the server would have to hold the whole file.
const COVER_SOURCE_MAX_BYTES = 80 * 1024 * 1024;
const COVER_EDGE = 2400;

// Makes the cover picture from one of the delivery's photos: the enhanced copy when there is one, turned upright and
// sized for a large screen. A photo the server cannot read (a camera RAW, say) is still chosen, and the page shows
// its small preview instead.
export async function setCoverPhoto(deliveryId: string, fileId: string): Promise<{ ok: true; url: string | null } | { ok: false; error: string }> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return { ok: false, error: viewOnlyError };
  if (!isUuid(deliveryId) || !isUuid(fileId)) return { ok: false, error: "This photo was not found." };
  const { rows } = await pool.query<{
    storageKey: string;
    enhancedKey: string | null;
    sizeBytes: string | null;
    enhancedBytes: string | null;
    thumbKey: string | null;
    oldKey: string | null;
  }>(
    `select f."storageKey", f."enhancedKey", f."sizeBytes", f."enhancedBytes", f."thumbKey", d."cover"->>'key' as "oldKey"
       from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"
      where f."id" = $1 and d."id" = $2 and d."ownerId" = $3 and f."storageKey" is not null`,
    [fileId, deliveryId, ownerId],
  );
  const file = rows[0];
  if (!file) return { ok: false, error: "This photo was not found." };

  let key: string | null = null;
  if (storageConfigured()) {
    const sourceKey = file.enhancedKey ?? file.storageKey;
    const size = Number(file.enhancedKey ? file.enhancedBytes : file.sizeBytes) || 0;
    if (size <= COVER_SOURCE_MAX_BYTES) {
      const source = await getObject(sourceKey);
      if (source) {
        try {
          const jpeg = await sharp(source.bytes, { limitInputPixels: 300_000_000 })
            .rotate()
            .resize({ width: COVER_EDGE, height: COVER_EDGE, fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 84, mozjpeg: true, progressive: true })
            .toBuffer();
          key = `deliveries/${deliveryId}/cover/${randomBytes(8).toString("hex")}.jpg`;
          await putObject(key, new Uint8Array(jpeg), "image/jpeg");
        } catch (error) {
          console.error("Could not make a cover picture", error);
          key = null;
        }
      }
    }
  }

  const result = await pool.query(
    `update "delivery" set "cover" = coalesce("cover", '{}'::jsonb) || $1::jsonb, "updatedAt" = now()
      where "id" = $2 and "ownerId" = $3`,
    [JSON.stringify({ fileId, key }), deliveryId, ownerId],
  );
  if (!result.rowCount) return { ok: false, error: "This delivery was not found." };
  if (file.oldKey && file.oldKey !== key) await deleteObjects([file.oldKey]);
  const shown = key ?? file.thumbKey;
  return { ok: true, url: shown && storageConfigured() ? await presignThumb(shown) : null };
}
