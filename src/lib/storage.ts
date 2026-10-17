import { randomBytes } from "node:crypto";
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  ListPartsCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Any S3-compatible store works. Production uses Cloudflare R2:
//   STORAGE_ENDPOINT=https://<account id>.r2.cloudflarestorage.com  STORAGE_REGION=auto (default)
// Locally, point it at an S3 test server and set STORAGE_FORCE_PATH_STYLE=true.
const env = process.env;

export const storageConfigured = () =>
  Boolean(env.STORAGE_BUCKET && env.STORAGE_ACCESS_KEY_ID && env.STORAGE_SECRET_ACCESS_KEY);

const globalForS3 = globalThis as unknown as { memocraftS3?: S3Client };

function s3(): S3Client {
  if (!globalForS3.memocraftS3) {
    globalForS3.memocraftS3 = new S3Client({
      region: env.STORAGE_REGION || "auto",
      endpoint: env.STORAGE_ENDPOINT || undefined,
      forcePathStyle: env.STORAGE_FORCE_PATH_STYLE === "true",
      credentials: {
        accessKeyId: env.STORAGE_ACCESS_KEY_ID as string,
        secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY as string,
      },
      // Newer SDKs add checksum headers by default, which break browser uploads to presigned URLs on R2.
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }
  return globalForS3.memocraftS3;
}

const bucket = () => env.STORAGE_BUCKET as string;

// A fresh random segment per upload, so a replacement never overwrites the file it replaces.
export const newObjectKey = (deliveryId: string, fileId: string) =>
  `deliveries/${deliveryId}/${fileId}/${randomBytes(8).toString("hex")}`;

const UPLOAD_URL_SECONDS = 60 * 60 * 6;
const DOWNLOAD_URL_SECONDS = 60 * 10;
// The owner's editor shows thumbnails for a whole working session. Those links are signed from a rounded start time,
// so the same picture keeps the same address while the owner edits and the browser does not fetch every thumbnail
// again after each save. A client's thumbnails are short-lived like downloads, so unpublishing cuts them off quickly.
const THUMB_URL_SECONDS = 2 * 60 * 60;
const THUMB_SIGNING_STEP_MS = 30 * 60 * 1000;
const CLIENT_THUMB_URL_SECONDS = 60 * 10;

export function presignPut(key: string, type: string, size: number) {
  return getSignedUrl(
    s3(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: type, ContentLength: size }),
    { expiresIn: UPLOAD_URL_SECONDS },
  );
}

export async function startMultipart(key: string, type: string): Promise<string> {
  const result = await s3().send(new CreateMultipartUploadCommand({ Bucket: bucket(), Key: key, ContentType: type }));
  if (!result.UploadId) throw new Error("Storage did not start the upload.");
  return result.UploadId;
}

export function presignPart(key: string, uploadId: string, partNumber: number, size: number) {
  return getSignedUrl(
    s3(),
    new UploadPartCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumber: partNumber, ContentLength: size }),
    { expiresIn: UPLOAD_URL_SECONDS },
  );
}

// The server lists the parts itself instead of trusting ETags from the browser, so the browser does not
// need to read response headers and a missing or wrong part is caught here.
export async function completeMultipart(key: string, uploadId: string, expectedSizes: number[]): Promise<boolean> {
  const parts: { PartNumber: number; ETag: string; Size: number }[] = [];
  let marker: string | undefined;
  for (;;) {
    const page = await s3().send(
      new ListPartsCommand({ Bucket: bucket(), Key: key, UploadId: uploadId, PartNumberMarker: marker, MaxParts: 1000 }),
    );
    for (const part of page.Parts ?? []) {
      if (part.PartNumber && part.ETag && part.Size !== undefined) {
        parts.push({ PartNumber: part.PartNumber, ETag: part.ETag, Size: part.Size });
      }
    }
    if (!page.IsTruncated || !page.NextPartNumberMarker) break;
    marker = page.NextPartNumberMarker;
  }
  parts.sort((a, b) => a.PartNumber - b.PartNumber);
  const complete =
    parts.length === expectedSizes.length &&
    parts.every((part, index) => part.PartNumber === index + 1 && part.Size === expectedSizes[index]);
  if (!complete) return false;
  await s3().send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket(),
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts.map(({ PartNumber, ETag }) => ({ PartNumber, ETag })) },
    }),
  );
  return true;
}

export async function abortMultipart(key: string, uploadId: string) {
  await s3().send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: key, UploadId: uploadId }));
}

export async function headObject(key: string): Promise<{ size: number } | null> {
  try {
    const result = await s3().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: result.ContentLength ?? 0 };
  } catch {
    return null;
  }
}

// Cleanup is best effort: a leftover object costs a little storage, but it must never break the action.
export async function deleteObjects(keys: string[]) {
  if (keys.length === 0 || !storageConfigured()) return;
  try {
    for (let start = 0; start < keys.length; start += 1000) {
      await s3().send(
        new DeleteObjectsCommand({
          Bucket: bucket(),
          Delete: { Objects: keys.slice(start, start + 1000).map((Key) => ({ Key })), Quiet: true },
        }),
      );
    }
  } catch (error) {
    console.error("Could not delete stored objects", error);
  }
}

export type PendingUpload = {
  key: string;
  uploadId: string | null;
  size: number;
  type: string;
  ext: string | null;
  at: string;
  // Set when the browser is also uploading a preview image for this file.
  thumbKey?: string;
  thumbSize?: number;
};

export async function discardPending(pending: PendingUpload) {
  if (!storageConfigured()) return;
  try {
    if (pending.uploadId) await abortMultipart(pending.key, pending.uploadId);
    else await deleteObjects([pending.key]);
    if (pending.thumbKey) await deleteObjects([pending.thumbKey]);
  } catch (error) {
    console.error("Could not discard an unfinished upload", error);
  }
}

// RFC 6266: a plain filename for old clients, and the real one, percent-encoded, for the rest.
export function attachmentDisposition(name: string): string {
  const fallback = name.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}

export function presignDownload(key: string, filename: string, type: string | null) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({
      Bucket: bucket(),
      Key: key,
      ResponseContentDisposition: attachmentDisposition(filename),
      ResponseContentType: type ?? undefined,
    }),
    { expiresIn: DOWNLOAD_URL_SECONDS },
  );
}

// A link to a thumbnail for the signed-in owner. Not a download: the browser shows it inline.
export function presignThumb(key: string) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentType: "image/jpeg" }),
    {
      expiresIn: THUMB_URL_SECONDS,
      signingDate: new Date(Math.floor(Date.now() / THUMB_SIGNING_STEP_MS) * THUMB_SIGNING_STEP_MS),
    },
  );
}

// A link to a thumbnail for a client who has the delivery link. Handed out by the preview route after it checks
// that the delivery is published.
export function presignClientThumb(key: string) {
  return getSignedUrl(
    s3(),
    new GetObjectCommand({ Bucket: bucket(), Key: key, ResponseContentType: "image/jpeg" }),
    { expiresIn: CLIENT_THUMB_URL_SECONDS },
  );
}

// Removes everything a set of deleted file rows left in storage: attached objects, thumbnails and unfinished uploads.
export async function removeStored(
  files: { storageKey: string | null; thumbKey?: string | null; pending: PendingUpload | null }[],
) {
  await deleteObjects(
    files.flatMap((file) => [...(file.storageKey ? [file.storageKey] : []), ...(file.thumbKey ? [file.thumbKey] : [])]),
  );
  for (const file of files) if (file.pending) await discardPending(file.pending);
}

// For the health check: "off" when no storage is configured, otherwise whether the bucket answers with these keys.
export async function storageStatus(): Promise<"off" | "ok" | "error"> {
  if (!storageConfigured()) return "off";
  try {
    await s3().send(new HeadBucketCommand({ Bucket: bucket() }));
    return "ok";
  } catch {
    return "error";
  }
}
