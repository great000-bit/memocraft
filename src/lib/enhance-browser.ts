import { randomBytes } from "node:crypto";
import { pool } from "./auth";
import { isUuid } from "./deliveries";
import { BROWSER_INPUT_MAX_PIXELS, ENHANCEABLE_TYPES, ENHANCE_SOURCE_MAX_BYTES, prepareInput } from "./enhance";
import { getObject } from "./storage";

// The free enhancer runs in the visitor's browser (public/enhance-worker.js). The server only hands the browser a
// picture to work on and, afterwards, keeps the enhanced copy the browser uploads.

export const browserEnhancedKey = (fileId: string) => `enhanced/${fileId}/${randomBytes(8).toString("hex")}.jpg`;
export const isBrowserEnhancedKey = (fileId: string, key: string) =>
  key.startsWith(`enhanced/${fileId}/`) && /^enhanced\/[0-9a-f-]{36}\/[0-9a-f]{16}\.jpg$/.test(key);

// Largest enhanced copy the browser may store: 4x of 800k pixels is a few megabytes of JPEG.
export const BROWSER_ENHANCED_MAX_BYTES = 40 * 1024 * 1024;

type Source = { storageKey: string | null; sizeBytes: string | null; mimeType: string | null };

// The owner's original, upright and at most 800k pixels, as a JPEG the browser can read without any cross-site rules.
export async function loadEnhanceSource(userId: string, fileId: string): Promise<{ bytes: Uint8Array } | { error: string; status: number }> {
  if (!isUuid(fileId)) return { error: "Not found", status: 404 };
  const { rows } = await pool.query<Source>(
    `select f."storageKey", f."sizeBytes", f."mimeType"
       from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"
      where f."id" = $1 and d."ownerId" = $2`,
    [fileId, userId],
  );
  const file = rows[0];
  if (!file?.storageKey) return { error: "Not found", status: 404 };
  if (!ENHANCEABLE_TYPES.includes(file.mimeType ?? "")) return { error: "Enhance works on JPEG, PNG, WebP and TIFF photos.", status: 415 };
  if (Number(file.sizeBytes ?? 0) > ENHANCE_SOURCE_MAX_BYTES) return { error: "This photo is too large to enhance.", status: 413 };
  const original = await getObject(file.storageKey);
  if (!original) return { error: "The original could not be read.", status: 502 };
  const input = await prepareInput(original.bytes, BROWSER_INPUT_MAX_PIXELS);
  return { bytes: input.bytes };
}
