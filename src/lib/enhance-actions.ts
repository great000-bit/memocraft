"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { pool } from "./auth";
import { isUuid } from "./deliveries";
import {
  ENHANCEABLE_TYPES,
  ENHANCE_SOURCE_MAX_BYTES,
  enhanceConfigured,
  enhanceFailure,
  finishOutput,
  getPrediction,
  monthlyEnhanceLimit,
  outputUrl,
  prepareInput,
  startPrediction,
  type Prediction,
} from "./enhance";
import { GeminiQuotaError, geminiConfigured, monthlyGeminiLimit, repairWithGemini } from "./gemini-enhance";
import { BROWSER_ENHANCED_MAX_BYTES, browserEnhancedKey, isBrowserEnhancedKey } from "./enhance-browser";
import { editableOwnerId, viewOnlyError, workspaceOwnerId } from "./team";
import { deleteObjects, getObject, getObjectRange, headObject, presignPut, presignView, putObject, storageConfigured } from "./storage";
import { formatSize, storageLimits } from "./storage-limits";
import { storageUsed } from "./storage-usage";

// The run in progress, kept on the file row until it is done.
type Job = { predictionId: string; inputKey: string; startedAt: string; finishing?: boolean; error?: string };

export type EnhanceState =
  | { state: "none" }
  | { state: "running" }
  | { state: "failed"; error: string }
  | { state: "ready"; bytes: number };

type OwnedFile = {
  deliveryId: string;
  storageKey: string | null;
  sizeBytes: string | null;
  mimeType: string | null;
  enhancedKey: string | null;
  enhancedBytes: string | null;
  enhanceJob: Job | null;
};

// A run that has not answered in this long is given up on, so the card never spins forever.
const RUN_TIMEOUT_MS = 10 * 60 * 1000;

async function loadOwned(fileId: string, ownerId: string): Promise<OwnedFile | null> {
  if (!isUuid(fileId)) return null;
  const { rows } = await pool.query<OwnedFile>(
    `select s."deliveryId", f."storageKey", f."sizeBytes", f."mimeType", f."enhancedKey", f."enhancedBytes", f."enhanceJob"
       from "deliveryFile" f
       join "deliverySection" s on s."id" = f."sectionId"
       join "delivery" d on d."id" = s."deliveryId"
      where f."id" = $1 and d."ownerId" = $2`,
    [fileId, ownerId],
  );
  return rows[0] ?? null;
}

function stateOf(file: OwnedFile): EnhanceState {
  if (file.enhanceJob?.error) return { state: "failed", error: file.enhanceJob.error };
  if (file.enhanceJob) return { state: "running" };
  if (file.enhancedKey) return { state: "ready", bytes: Number(file.enhancedBytes ?? 0) };
  return { state: "none" };
}

function refresh(deliveryId: string) {
  revalidatePath(`/deliveries/${deliveryId}`);
}

async function failRun(fileId: string, job: Job, error: string) {
  await pool.query(
    `update "deliveryFile" set "enhanceJob" = jsonb_build_object('predictionId', $2::text, 'error', $3::text)
      where "id" = $1 and "enhanceJob"->>'predictionId' = $2`,
    [fileId, job.predictionId, error],
  );
  await deleteObjects([job.inputKey]);
}

// Runs used this calendar month (UTC), counted from their own table so removing a photo does not give a run back.
async function runsThisMonth(ownerId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `select count(*) from "enhanceRun" where "userId" = $1 and "at" >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'`,
    [ownerId],
  );
  return Number(rows[0].count);
}

// The in-browser enhancer is free and has no monthly allowance; the server one (Replicate) only exists when its token is set.
export async function enhanceAllowance(): Promise<{ used: number; limit: number; on: boolean; server: boolean; gemini: boolean; geminiLeft: number }> {
  const ownerId = await workspaceOwnerId();
  const on = storageConfigured();
  const server = on && enhanceConfigured();
  const gemini = on && geminiConfigured();
  const geminiLeft = gemini ? Math.max(0, monthlyGeminiLimit() - (await geminiRunsThisMonth(ownerId))) : 0;
  return { used: server ? await runsThisMonth(ownerId) : 0, limit: monthlyEnhanceLimit(), on, server, gemini, geminiLeft };
}

async function geminiRunsThisMonth(ownerId: string): Promise<number> {
  const { rows } = await pool.query<{ count: string }>(
    `select count(*) from "enhanceRun" where "userId" = $1 and "predictionId" like 'gemini-%'
        and "at" >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'`,
    [ownerId],
  );
  return Number(rows[0].count);
}

// Face and detail repair with Gemini: the photo is sent to Google and the answer comes back in the same request.
export async function repairWithGeminiAction(fileId: string): Promise<EnhanceState> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return { state: "failed", error: viewOnlyError };
  const file = await loadOwned(fileId, ownerId);
  if (!file || !file.storageKey) return { state: "failed", error: "This photo was not found." };
  if (!geminiConfigured() || !storageConfigured()) return { state: "failed", error: "Memocraft repair is not switched on yet." };
  if (file.enhanceJob && !file.enhanceJob.error) return { state: "running" };
  if (!ENHANCEABLE_TYPES.includes(file.mimeType ?? "")) return { state: "failed", error: "Repair works on JPEG, PNG, WebP and TIFF photos." };
  if (Number(file.sizeBytes ?? 0) > ENHANCE_SOURCE_MAX_BYTES) {
    return { state: "failed", error: `Repair works on photos up to ${formatSize(ENHANCE_SOURCE_MAX_BYTES)}.` };
  }
  const limit = monthlyGeminiLimit();
  if ((await geminiRunsThisMonth(ownerId)) >= limit) {
    return { state: "failed", error: `You have used all ${limit} Memocraft repairs for this month. They come back on the 1st.` };
  }
  if ((await storageUsed(ownerId)) + 8 * 1024 * 1024 > storageLimits.accountBytes) {
    return { state: "failed", error: "Your storage is full. Remove a file to make room for the repaired copy." };
  }
  const runId = `gemini-${randomBytes(8).toString("hex")}`;
  const key = `enhanced/${fileId}/${randomBytes(8).toString("hex")}.jpg`;
  try {
    const original = await getObject(file.storageKey);
    if (!original) return { state: "failed", error: "The original could not be read from storage. Try again." };
    const input = await prepareInput(original.bytes, 2_000_000);
    // The run is counted before the call, so a failing loop cannot spend the free quota unnoticed.
    await pool.query(`insert into "enhanceRun" ("userId", "fileId", "predictionId") values ($1, $2, $3)`, [ownerId, fileId, runId]);
    const repaired = await repairWithGemini(input.bytes);
    if (!repaired) return { state: "failed", error: "The repair did not return a picture for this photo. Your original is untouched. Try again." };
    const jpeg = await finishOutput(repaired);
    await putObject(key, jpeg, "image/jpeg");
    const old = await pool.query<{ enhancedKey: string | null }>(`select "enhancedKey" from "deliveryFile" where "id" = $1`, [fileId]);
    const saved = await pool.query(
      `update "deliveryFile" set "enhancedKey" = $2, "enhancedBytes" = $3, "enhanceJob" = null
        where "id" = $1 and ("enhanceJob" is null or "enhanceJob" ? 'error')`,
      [fileId, key, jpeg.byteLength],
    );
    if (!saved.rowCount) {
      await deleteObjects([key]);
      return { state: "failed", error: "The photo changed while it was repaired. Try again." };
    }
    const previous = old.rows[0]?.enhancedKey;
    if (previous && previous !== key) await deleteObjects([previous]);
    await pool.query(`update "delivery" set "updatedAt" = now() where "id" = $1`, [file.deliveryId]);
    refresh(file.deliveryId);
    return { state: "ready", bytes: jpeg.byteLength };
  } catch (error) {
    await deleteObjects([key]);
    if (error instanceof GeminiQuotaError) {
      // Not the creative's fault and not a run they used: take it off their monthly count.
      await pool.query(`delete from "enhanceRun" where "predictionId" = $1`, [runId]);
      return {
        state: "failed",
        error: "Memocraft repair is not available right now: Google needs billing turned on for this key. Your original is untouched.",
      };
    }
    console.error("Gemini repair failed", error);
    return { state: "failed", error: "The repair did not work on this photo. Your original is untouched. Try again in a moment." };
  }
}

type BrowserUpload = { ok: true; key: string; url: string } | { ok: false; error: string };

// Step before the browser uploads the copy it made: checks the photo is the caller's and there is room, and
// hands back a one-use upload link for exactly that size.
export async function prepareBrowserEnhance(fileId: string, size: number): Promise<BrowserUpload> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return { ok: false, error: viewOnlyError };
  const file = await loadOwned(fileId, ownerId);
  if (!file || !file.storageKey || !storageConfigured()) return { ok: false, error: "This photo was not found." };
  if (file.enhanceJob && !file.enhanceJob.error) return { ok: false, error: "An enhance is already running on this photo." };
  if (!Number.isInteger(size) || size < 1 || size > BROWSER_ENHANCED_MAX_BYTES) return { ok: false, error: "The enhanced copy is the wrong size." };
  if ((await storageUsed(ownerId)) + size > storageLimits.accountBytes) {
    return { ok: false, error: "Your storage is full. Remove a file to make room for the enhanced copy." };
  }
  const key = browserEnhancedKey(fileId);
  return { ok: true, key, url: await presignPut(key, "image/jpeg", size) };
}

// Step after the upload: keeps the copy the browser stored, in place of any earlier one.
export async function finishBrowserEnhance(fileId: string, key: string): Promise<EnhanceState> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return { state: "failed", error: viewOnlyError };
  const file = await loadOwned(fileId, ownerId);
  if (!file) return { state: "failed", error: "This photo was not found." };
  const discard = async (error: string): Promise<EnhanceState> => {
    if (isBrowserEnhancedKey(fileId, key)) await deleteObjects([key]);
    return { state: "failed", error };
  };
  if (!isBrowserEnhancedKey(fileId, key)) return { state: "failed", error: "The enhanced copy was not recognised." };
  const stored = await headObject(key);
  if (!stored || stored.size < 1 || stored.size > BROWSER_ENHANCED_MAX_BYTES) return discard("The enhanced copy did not upload. Try again.");
  const head = await getObjectRange(key, 0, 2).catch(() => new Uint8Array());
  if (head[0] !== 0xff || head[1] !== 0xd8 || head[2] !== 0xff) return discard("The enhanced copy was not a picture. Try again.");
  const saved = await pool.query(
    `update "deliveryFile" set "enhancedKey" = $2, "enhancedBytes" = $3, "enhanceJob" = null
      where "id" = $1 and ("enhanceJob" is null or "enhanceJob" ? 'error')`,
    [fileId, key, stored.size],
  );
  if (!saved.rowCount) return discard("The photo changed while it was enhanced. Try again.");
  if (file.enhancedKey && file.enhancedKey !== key) await deleteObjects([file.enhancedKey]);
  await pool.query(`update "delivery" set "updatedAt" = now() where "id" = $1`, [file.deliveryId]);
  refresh(file.deliveryId);
  return { state: "ready", bytes: stored.size };
}

export async function startEnhance(fileId: string, faces: boolean): Promise<EnhanceState> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return { state: "failed", error: viewOnlyError };
  const file = await loadOwned(fileId, ownerId);
  if (!file || !file.storageKey) return { state: "failed", error: "This photo was not found." };
  if (!enhanceConfigured() || !storageConfigured()) return { state: "failed", error: "Enhance is not switched on yet." };
  if (file.enhanceJob && !file.enhanceJob.error) return { state: "running" };
  if (!ENHANCEABLE_TYPES.includes(file.mimeType ?? "")) {
    return { state: "failed", error: "Enhance works on JPEG, PNG, WebP and TIFF photos." };
  }
  if (Number(file.sizeBytes ?? 0) > ENHANCE_SOURCE_MAX_BYTES) {
    return { state: "failed", error: `Enhance works on photos up to ${formatSize(ENHANCE_SOURCE_MAX_BYTES)}.` };
  }
  const limit = monthlyEnhanceLimit();
  if ((await runsThisMonth(ownerId)) >= limit) {
    return { state: "failed", error: `You have used all ${limit} enhances for this month. They come back on the 1st.` };
  }
  // An enhanced copy is usually a few megabytes; this keeps the account from going far past its storage.
  if ((await storageUsed(ownerId)) + 8 * 1024 * 1024 > storageLimits.accountBytes) {
    return { state: "failed", error: "Your storage is full. Remove a file to make room for the enhanced copy." };
  }

  let prediction: Prediction;
  const inputKey = `enhance-input/${fileId}/${randomBytes(8).toString("hex")}.jpg`;
  try {
    const original = await getObject(file.storageKey);
    if (!original) return { state: "failed", error: "The original could not be read from storage. Try again." };
    const input = await prepareInput(original.bytes);
    await putObject(inputKey, input.bytes, "image/jpeg");
    prediction = await startPrediction(await presignView(inputKey), input.scale, faces);
  } catch (error) {
    console.error("Could not start an enhance", error);
    await deleteObjects([inputKey]);
    return { state: "failed", error: "Enhance could not start. Try again in a moment." };
  }

  const job: Job = { predictionId: prediction.id, inputKey, startedAt: new Date().toISOString() };
  await pool.query(`insert into "enhanceRun" ("userId", "fileId", "predictionId") values ($1, $2, $3)`, [
    ownerId,
    fileId,
    prediction.id,
  ]);
  const claimed = await pool.query(
    `update "deliveryFile" set "enhanceJob" = $2::jsonb where "id" = $1 and ("enhanceJob" is null or "enhanceJob" ? 'error')`,
    [fileId, JSON.stringify(job)],
  );
  if (!claimed.rowCount) return { state: "running" };
  // A warm model often finishes inside the first request.
  if (prediction.status === "succeeded" || prediction.status === "failed" || prediction.status === "canceled") {
    return settle(fileId, file.deliveryId, job, prediction);
  }
  refresh(file.deliveryId);
  return { state: "running" };
}

// The editor asks every few seconds while a run is going.
export async function checkEnhance(fileId: string): Promise<EnhanceState> {
  const ownerId = await workspaceOwnerId();
  const file = await loadOwned(fileId, ownerId);
  if (!file) return { state: "failed", error: "This photo was not found." };
  const job = file.enhanceJob;
  if (!job || job.error || job.finishing) return stateOf(file);
  if (Date.now() - Date.parse(job.startedAt) > RUN_TIMEOUT_MS) {
    await failRun(fileId, job, "The enhance took too long. Your original is untouched. Try again.");
    return { state: "failed", error: "The enhance took too long. Your original is untouched. Try again." };
  }
  try {
    return await settle(fileId, file.deliveryId, job, await getPrediction(job.predictionId));
  } catch (error) {
    console.error("Could not check an enhance", error);
    return { state: "running" };
  }
}

async function settle(fileId: string, deliveryId: string, job: Job, prediction: Prediction): Promise<EnhanceState> {
  if (prediction.status === "starting" || prediction.status === "processing") return { state: "running" };
  const result = outputUrl(prediction);
  if (prediction.status !== "succeeded" || !result) {
    console.error("Enhance run failed", prediction.id, prediction.error);
    await failRun(fileId, job, enhanceFailure);
    refresh(deliveryId);
    return { state: "failed", error: enhanceFailure };
  }
  // Only one request turns the model's answer into the stored copy.
  const claim = await pool.query(
    `update "deliveryFile" set "enhanceJob" = "enhanceJob" || '{"finishing": true}'::jsonb
      where "id" = $1 and "enhanceJob"->>'predictionId' = $2 and not ("enhanceJob" ? 'finishing') and not ("enhanceJob" ? 'error')`,
    [fileId, job.predictionId],
  );
  if (!claim.rowCount) return { state: "running" };

  const key = `enhanced/${fileId}/${randomBytes(8).toString("hex")}.jpg`;
  try {
    const response = await fetch(result, { cache: "no-store" });
    if (!response.ok) throw new Error(`Output download answered ${response.status}`);
    const jpeg = await finishOutput(new Uint8Array(await response.arrayBuffer()));
    await putObject(key, jpeg, "image/jpeg");
    const old = await pool.query<{ enhancedKey: string | null }>(`select "enhancedKey" from "deliveryFile" where "id" = $1`, [fileId]);
    const saved = await pool.query(
      `update "deliveryFile" set "enhancedKey" = $3, "enhancedBytes" = $4, "enhanceJob" = null
        where "id" = $1 and "enhanceJob"->>'predictionId' = $2`,
      [fileId, job.predictionId, key, jpeg.byteLength],
    );
    // The photo was replaced or removed while the model worked: the result belongs to nothing.
    if (!saved.rowCount) {
      await deleteObjects([key, job.inputKey]);
      return { state: "none" };
    }
    const previous = old.rows[0]?.enhancedKey;
    await deleteObjects([job.inputKey, ...(previous && previous !== key ? [previous] : [])]);
    await pool.query(`update "delivery" set "updatedAt" = now() where "id" = $1`, [deliveryId]);
    refresh(deliveryId);
    return { state: "ready", bytes: jpeg.byteLength };
  } catch (error) {
    console.error("Could not store an enhanced copy", error);
    await deleteObjects([key]);
    await failRun(fileId, job, enhanceFailure);
    refresh(deliveryId);
    return { state: "failed", error: enhanceFailure };
  }
}

// Goes back to sending the original only. The run still counts toward the month.
export async function removeEnhanced(fileId: string): Promise<EnhanceState> {
  const ownerId = await editableOwnerId();
  if (!ownerId) return { state: "failed", error: viewOnlyError };
  const file = await loadOwned(fileId, ownerId);
  if (!file) return { state: "failed", error: "This photo was not found." };
  await pool.query(`update "deliveryFile" set "enhancedKey" = null, "enhancedBytes" = null, "enhanceJob" = null where "id" = $1`, [fileId]);
  await deleteObjects([file.enhancedKey, file.enhanceJob?.inputKey].filter((key): key is string => Boolean(key)));
  refresh(file.deliveryId);
  return { state: "none" };
}

// Short-lived links to the original and the enhanced copy, for the before-and-after view in the editor.
export async function enhanceCompareUrls(fileId: string): Promise<{ ok: true; before: string; after: string } | { ok: false; error: string }> {
  const ownerId = await workspaceOwnerId();
  const file = await loadOwned(fileId, ownerId);
  if (!file?.storageKey || !file.enhancedKey || !storageConfigured()) return { ok: false, error: "There is no enhanced copy to show." };
  return {
    ok: true,
    before: await presignView(file.storageKey, file.mimeType ?? "image/jpeg"),
    after: await presignView(file.enhancedKey),
  };
}
